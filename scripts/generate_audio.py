#!/usr/bin/env python3
"""
Tạo giọng đọc mẫu cho "Nói Chuẩn" bằng VieNeu-TTS v3 Turbo.

  data/lessons.json  ──►  VieNeu-TTS  ──►  kéo chậm 0,75 (rubberband, giữ formant)
                     ──►  cắt lặng + chuẩn hóa -16 LUFS + MP3 44.1kHz 128kbps
                     ──►  forced alignment (whisperX) lấy mốc âm tiết / âm vị
                     ──►  public/audio/<giong>/<id>.mp3, public/audio/<giong>/normal/<id>.mp3
                     ──►  public/audio/manifest.json

Chạy lại nhanh: bỏ qua mục đã có file và hash nội dung không đổi.

Ví dụ:
  uv run python scripts/generate_audio.py                       # tất cả giọng, tất cả mục
  uv run python scripts/generate_audio.py --voices bac --limit 5
  uv run python scripts/generate_audio.py --only ln-w-01,ln-p-01#0 --force
  python scripts/generate_audio.py --list-voices                # nghe thử / chọn giọng có sẵn
  python scripts/generate_audio.py --engine mock --out /tmp/audio-test   # kiểm thử pipeline, KHÔNG dùng cho app

Yêu cầu: Python 3.10+, ffmpeg (có filter rubberband) hoặc pyrubberband / CLI rubberband,
VieNeu-TTS (SDK `vieneu`), tùy chọn whisperX cho forced alignment.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import unicodedata
import wave
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LESSONS = ROOT / "data" / "lessons.json"
PHONEMES = ROOT / "data" / "phonemes.json"
VOICES = ROOT / "scripts" / "voices.json"
DEFAULT_OUT = ROOT / "public" / "audio"
TMP = ROOT / "tmp"

PIPELINE_VERSION = "2"  # tăng khi đổi cách xử lý âm thanh để buộc tạo lại
SLOW_TEMPO = 0.75


def log(*a):
    print(*a, flush=True)


# --------------------------------------------------------------------------- dữ liệu
def collect_items() -> list[dict]:
    """Danh sách {id, text} khớp với allAudioIds() trong src/lib/content.ts."""
    data = json.loads(LESSONS.read_text(encoding="utf-8"))
    out = []
    for it in data["items"]:
        if it["type"] == "minimal_pair":
            for k, o in enumerate(it["options"]):
                out.append({"id": f"{it['id']}#{k}", "text": o["text"]})
        else:
            out.append({"id": it["id"], "text": it["text"]})
    for p in data.get("prompts", []):
        out.append({"id": p["id"], "text": p["text"]})
    for st in data.get("stories", []):
        for k, pg in enumerate(st["pages"]):
            out.append({"id": f"{st['id']}-{k + 1}", "text": pg["text"]})
    ph = json.loads(PHONEMES.read_text(encoding="utf-8"))
    for key, p in ph["phonemes"].items():
        if key != "rest" and p.get("kidHint"):
            out.append({"id": f"hint-{key}", "text": p["kidHint"].rstrip(".!") + " nhé!"})
    return out


def safe_name(item_id: str) -> str:
    return item_id.replace("#", "_")


def tts_text(text: str) -> str:
    """Chuẩn bị văn bản cho TTS: một từ đơn được thêm dấu chấm để ngắt giọng tự nhiên."""
    t = unicodedata.normalize("NFC", text.strip())
    if not re.search(r"[.!?…]$", t):
        t += "."
    return t


def content_hash(text: str, voice_cfg: dict, engine: str) -> str:
    h = hashlib.sha1()
    payload = json.dumps(
        {"t": tts_text(text), "v": voice_cfg, "e": engine, "p": PIPELINE_VERSION, "tempo": SLOW_TEMPO, "c": CARRIER if needs_carrier(text) else ""},
        ensure_ascii=False,
        sort_keys=True,
    )
    h.update(payload.encode("utf-8"))
    return h.hexdigest()[:16]


# --------------------------------------------------------------------------- engines
class VieneuEngine:
    name = "vieneu"

    def __init__(self, backend: str | None, precision: str | None):
        try:
            from vieneu import Vieneu  # type: ignore
        except ImportError:
            sys.exit(
                "Chưa cài VieNeu-TTS. Xem README: clone repo VieNeu (commit trong scripts/voices.json), "
                "chạy `uv sync` (CPU) hoặc `uv sync --extra cuda` (GPU)."
            )
        kwargs = {}
        if backend:
            kwargs["backend"] = backend  # "onnx" khi không có GPU
        if precision:
            kwargs["precision"] = precision  # mặc định fp32 trên CPU – nên giữ fp32
        log(f"[vieneu] khởi tạo {kwargs or '(mặc định v3 Turbo)'} …")
        self.tts = Vieneu(**kwargs)
        self._registered: set[str] = set()

    def list_voices(self):
        return self.tts.list_preset_voices()

    def synth(self, text: str, voice_cfg: dict, out_wav: Path):
        ref = voice_cfg.get("ref_audio")
        if ref:
            ref_path = (ROOT / ref).resolve()
            if not ref_path.exists():
                sys.exit(f"Không thấy file giọng mẫu: {ref_path}")
            name = voice_cfg.get("clone_name") or f"noichuan-{ref_path.stem}"
            if name not in self._registered:
                # Đăng ký giọng nhân bản một lần (giáo viên ĐÃ ĐỒNG Ý cho dùng giọng)
                self.tts.add_voice(name, str(ref_path), denoise=voice_cfg.get("denoise", True))
                self._registered.add(name)
            audio = self.tts.infer(text, voice=name)
        else:
            audio = self.tts.infer(text, voice=voice_cfg["preset"])
        self.tts.save(audio, str(out_wav))


class MockEngine:
    """Engine giả lập (tông nhạc theo âm tiết) – CHỈ để kiểm thử pipeline khi chưa có mô hình."""

    name = "mock"

    def list_voices(self):
        return [("mock", "mock")]

    def synth(self, text: str, voice_cfg: dict, out_wav: Path):
        sr = 48000
        syl = [s for s in re.split(r"\s+", text.strip()) if s]
        frames = bytearray()
        base = 220 if voice_cfg.get("preset", "").startswith("Thùy") else 260
        frames += b"\x00\x00" * int(sr * 0.25)
        for i, s in enumerate(syl):
            dur = 0.28 + 0.03 * min(len(s), 6)
            f = base * (1 + 0.06 * (i % 3))
            for n in range(int(sr * dur)):
                env = math.sin(math.pi * n / (sr * dur))
                v = 0.35 * env * (math.sin(2 * math.pi * f * n / sr) + 0.3 * math.sin(4 * math.pi * f * n / sr))
                frames += struct.pack("<h", int(v * 32767 * 0.7))
            gap = 0.3 if re.search(r"[.,!?;:]$", s) else 0.06
            frames += b"\x00\x00" * int(sr * gap)
        frames += b"\x00\x00" * int(sr * 0.3)
        with wave.open(str(out_wav), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes(bytes(frames))


# --------------------------------------------------------------------------- xử lý âm thanh
def run(cmd: list[str]):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"Lệnh lỗi: {' '.join(cmd)}\n{r.stderr[-1500:]}")
    return r


def ffmpeg_has_rubberband() -> bool:
    try:
        r = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True)
        return " rubberband " in r.stdout
    except FileNotFoundError:
        sys.exit("Không tìm thấy ffmpeg. Cài ffmpeg (bản có librubberband).")


def time_stretch(src: Path, dst: Path, method: str):
    """Kéo chậm còn 0,75, giữ cao độ và âm sắc (formant)."""
    if method == "ffmpeg":
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af",
             f"rubberband=tempo={SLOW_TEMPO}:formant=preserved:pitchq=quality", str(dst)])
    elif method == "pyrubberband":
        import pyrubberband as pyrb  # type: ignore
        import soundfile as sf  # type: ignore
        y, sr = sf.read(str(src))
        sf.write(str(dst), pyrb.time_stretch(y, sr, SLOW_TEMPO, rbargs={"--formant": ""}), sr)
    elif method == "rubberband-cli":
        run(["rubberband", "-q", "-T", str(SLOW_TEMPO), "--formant", str(src), str(dst)])
    else:  # atempo: giữ cao độ nhưng chất lượng kém hơn – chỉ dùng khi bất đắc dĩ
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af", f"atempo={SLOW_TEMPO}", str(dst)])


def pick_stretch_method(pref: str | None) -> str:
    if pref:
        return pref
    if ffmpeg_has_rubberband():
        return "ffmpeg"
    try:
        import pyrubberband  # noqa: F401
        return "pyrubberband"
    except ImportError:
        pass
    if shutil.which("rubberband"):
        return "rubberband-cli"
    log("⚠️  Không có rubberband – dùng atempo (chất lượng thấp hơn). Nên cài ffmpeg có librubberband.")
    return "atempo"


# Cắt lặng đầu/cuối (đảo chiều để cắt đuôi), đệm 80ms cho tự nhiên, chuẩn hóa -16 LUFS.
POST_FILTER = (
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,"
    "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,"
    "adelay=80|80,apad=pad_dur=0.12,"
    "loudnorm=I=-16:TP=-1.5:LRA=11"
)


def finalize_mp3(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af", POST_FILTER,
         "-ar", "44100", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "128k", str(dst)])


def duration_of(path: Path) -> float:
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
    return round(float(r.stdout.strip() or 0), 3)


# --------------------------------------------------------------------------- alignment
ONSET_POSE = {
    "b": "m", "p": "m", "m": "m", "ph": "v", "v": "v", "t": "t", "th": "t", "đ": "t", "d": "x", "gi": "x",
    "n": "n", "nh": "n", "l": "l", "s": "s", "x": "x", "ch": "ch", "tr": "tr", "r": "r", "qu": "u",
}
ONSETS = ["ngh", "ng", "nh", "ch", "tr", "th", "ph", "kh", "gh", "gi", "qu", "b", "c", "d", "đ", "g", "h", "k",
          "l", "m", "n", "p", "r", "s", "t", "v", "x"]


def strip_marks(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn").replace("đ", "d")


def syllable_visemes(syl: str) -> list[tuple[str, float]]:
    """Bản Python của syllableVisemes() trong src/lib/vietnamese.ts (rút gọn)."""
    s = unicodedata.normalize("NFC", syl.lower())
    onset = next((o for o in ONSETS if s.startswith(o)), "")
    if onset == "g" and len(s) > 1 and strip_marks(s[1]) == "i" and s[1] != "i":
        onset = "gi"  # "gì": chữ i mang dấu là một ký tự
        rest = strip_marks(s[1:])
    else:
        rest = strip_marks(s[len(onset):])
    keys: list[tuple[str, float]] = []
    if onset:
        keys.append((ONSET_POSE.get(onset, "rest"), 0.32))
    m = re.match(r"([aeiouy]+)(.*)", rest)
    vowels, coda = (m.group(1), m.group(2)) if m else ("a", "")
    if not coda and len(vowels) >= 2 and vowels[-1] in "iyou":
        coda, vowels = vowels[-1], vowels[:-1]
    vmap = {"a": "a", "e": "i", "i": "i", "y": "i", "o": "o", "u": "u"}
    vposes: list[str] = []
    for c in vowels:
        p = vmap.get(c, "a")
        if not vposes or vposes[-1] != p:
            vposes.append(p)
    vposes = vposes[:2] or ["a"]
    for p in vposes:
        keys.append((p, 0.48 / len(vposes)))
    if coda:
        cmap = [("ng", "rest"), ("nh", "i"), ("ch", "i"), ("m", "m"), ("p", "m"), ("n", "n"), ("t", "t"),
                ("c", "rest"), ("i", "i"), ("y", "i"), ("o", "u"), ("u", "u")]
        for suf, pose in cmap:
            if coda.endswith(suf):
                keys.append((pose, 0.2))
                break
    total = sum(w for _, w in keys)
    return [(p, w / total) for p, w in keys]


def add_phonemes(marks: list[dict]) -> list[dict]:
    for mk in marks:
        t, dur = mk["start"], mk["end"] - mk["start"]
        ph = []
        for pose, w in syllable_visemes(mk["text"]):
            ph.append({"start": round(t, 3), "end": round(t + dur * w, 3), "pose": pose})
            t += dur * w
        mk["phonemes"] = ph
    return marks


def clean_tokens(text: str) -> list[tuple[str, bool]]:
    toks = []
    for raw in text.split():
        w = re.sub(r"[^\wÀ-ỹ]", "", raw, flags=re.UNICODE).lower()
        if w:
            toks.append((w, bool(re.search(r"[.,!?;:]$", raw))))
    return toks


def align_estimate(text: str, wav: Path) -> list[dict]:
    """Ước lượng: chia vùng có tiếng (silencedetect) theo số âm tiết, trừ chỗ ngắt dấu câu."""
    dur = duration_of(wav)
    r = subprocess.run(["ffmpeg", "-i", str(wav), "-af", "silencedetect=noise=-38dB:d=0.12", "-f", "null", "-"],
                       capture_output=True, text=True)
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    speech_start = ends[0] if starts and starts[0] < 0.05 and ends else 0.0
    speech_end = starts[-1] if starts and starts[-1] > speech_start and (not ends or starts[-1] > ends[-1]) else dur
    toks = clean_tokens(text)
    if not toks:
        return []
    weights = [0.8 + 0.05 * min(len(w), 6) for w, _ in toks]
    pauses = sum(0.6 for _, p in toks[:-1] if p)
    unit = (speech_end - speech_start) / (sum(weights) + pauses)
    t, marks = speech_start, []
    for (w, p), wt in zip(toks, weights):
        marks.append({"start": round(t, 3), "end": round(t + wt * unit, 3), "text": w})
        t += wt * unit + (0.6 * unit if p else 0)
    return add_phonemes(marks)


class WhisperXAligner:
    """Forced alignment với transcript đã biết (wav2vec2 tiếng Việt của whisperX)."""

    def __init__(self, device: str):
        import whisperx  # type: ignore
        self.whisperx = whisperx
        self.device = device
        self.model, self.meta = whisperx.load_align_model(language_code="vi", device=device)

    def align(self, text: str, wav: Path) -> list[dict]:
        audio = self.whisperx.load_audio(str(wav))
        dur = len(audio) / 16000
        segs = [{"text": " ".join(w for w, _ in clean_tokens(text)), "start": 0.0, "end": dur}]
        res = self.whisperx.align(segs, self.model, self.meta, audio, self.device, return_char_alignments=False)
        marks = []
        for w in res.get("word_segments", []):
            if "start" in w and "end" in w:
                marks.append({"start": round(w["start"], 3), "end": round(w["end"], 3), "text": w["word"].lower()})
        if len(marks) < len(clean_tokens(text)) * 0.6:
            raise RuntimeError("alignment thiếu từ")
        return add_phonemes(marks)


# --------------------------------------------------------------------------- câu đệm cho từ đơn
# VieNeu (mô hình kiểu ngôn ngữ) đọc kém ổn định khi đầu vào chỉ có 1–2 âm tiết. Từ đơn được đọc trong
# câu đệm "Con đọc: <từ>." rồi cắt lấy phần sau khoảng lặng dài nhất.
CARRIER = "Con đọc: "


def needs_carrier(text: str) -> bool:
    return len(clean_tokens(text)) <= 2 and not re.search(r"[,;:!?]", text)


def silences(wav: Path, noise="-40dB", d=0.07) -> list[tuple[float, float]]:
    r = subprocess.run(["ffmpeg", "-i", str(wav), "-af", f"silencedetect=noise={noise}:d={d}", "-f", "null", "-"], capture_output=True, text=True)
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    return list(zip(starts, ends))


def cut_after_carrier(src: Path, dst: Path) -> bool:
    dur = duration_of(src)
    gaps = [(e - s, s, e) for s, e in silences(src) if s > 0.25 and e < dur - 0.2]
    if not gaps:
        return False
    _, _, end = max(gaps)
    run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{max(0.0, end - 0.03):.3f}", "-i", str(src), str(dst)])
    return duration_of(dst) > 0.15


# --------------------------------------------------------------------------- kiểm tra bằng ASR
MERGE = {"x": "s", "tr": "ch", "gi": "d", "r": "d"}  # cặp mà ASR (dữ liệu giọng Bắc) không phân biệt được


def norm_tokens(text: str) -> list[str]:
    return [w for w, _ in clean_tokens(unicodedata.normalize("NFC", text))]


def loose(tok: str) -> str:
    onset = next((o for o in ONSETS if tok.startswith(o)), "")
    return MERGE.get(onset, onset) + tok[len(onset):]


class AsrVerifier:
    """Nghe lại file vừa tạo bằng faster-whisper và so với văn bản."""

    def __init__(self, model: str):
        from faster_whisper import WhisperModel  # type: ignore
        self.m = WhisperModel(model, device="cpu", compute_type="int8")

    def heard(self, wav: Path) -> str:
        import numpy as np
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
        segs, _ = self.m.transcribe(np.frombuffer(raw, np.float32), language="vi", beam_size=5)
        return "".join(x.text for x in segs).strip()

    def word_start(self, wav: Path, text: str, n_last: int) -> float | None:
        """Thời điểm bắt đầu của n từ cuối (để cắt bỏ câu đệm)."""
        import numpy as np
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
        segs, _ = self.m.transcribe(np.frombuffer(raw, np.float32), language="vi", beam_size=5, word_timestamps=True, initial_prompt=CARRIER + text)
        words = [w for sg in segs for w in (sg.words or [])]
        if len(words) < n_last + 1:
            return None
        return words[-n_last].start

    def check(self, text: str, wav: Path, carrier: bool) -> dict:
        """Một lượt nhận dạng: so khớp + (với câu đệm) thời điểm bắt đầu của từ mục tiêu để cắt."""
        import numpy as np
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
        segs, _ = self.m.transcribe(np.frombuffer(raw, np.float32), language="vi", beam_size=5, word_timestamps=carrier)
        segs = list(segs)
        heard = "".join(x.text for x in segs).strip()
        e = norm_tokens(text)
        h = norm_tokens(heard)
        start = None
        if carrier:
            h = h[-len(e):]
            words = [w for sg in segs for w in (sg.words or [])]
            if len(words) > len(e):
                start = words[-len(e)].start
        if h == e:
            return {"heard": heard, "match": "exact", "acc": 1.0, "start": start}
        same = sum(1 for a, b in zip(e, h) if loose(a) == loose(b))
        acc = round(same / max(len(e), len(h), 1), 3)
        ok = acc >= (1.0 if len(e) <= 2 else 0.9)
        return {"heard": heard, "match": "loose" if ok else "mismatch", "acc": acc, "start": start}


class WhisperWordAligner:
    """Mốc từng âm tiết bằng word_timestamps của faster-whisper (không cần PyTorch)."""

    def __init__(self, verifier: "AsrVerifier"):
        self.v = verifier

    def align(self, text: str, wav: Path) -> list[dict]:
        import numpy as np
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
        segs, _ = self.v.m.transcribe(np.frombuffer(raw, np.float32), language="vi", beam_size=5, word_timestamps=True,
                                      initial_prompt=text)
        words = [w for sg in segs for w in (sg.words or [])]
        toks = clean_tokens(text)
        if len(words) != len(toks):
            raise RuntimeError(f"số từ lệch ({len(words)}/{len(toks)})")
        marks = [{"start": round(w.start, 3), "end": round(w.end, 3), "text": t} for w, (t, _) in zip(words, toks)]
        return add_phonemes(marks)


# --------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description="Tạo giọng đọc mẫu Nói Chuẩn bằng VieNeu-TTS")
    ap.add_argument("--voices", default=None, help="danh sách giọng, vd: bac,nam (mặc định: tất cả trong voices.json)")
    ap.add_argument("--only", default=None, help="chỉ tạo các id này (phân tách bằng dấu phẩy)")
    ap.add_argument("--limit", type=int, default=0, help="giới hạn số mục (để thử nhanh)")
    ap.add_argument("--force", action="store_true", help="tạo lại kể cả khi hash không đổi")
    ap.add_argument("--engine", choices=["vieneu", "mock"], default="vieneu")
    ap.add_argument("--backend", default=None, help='VieNeu backend, vd "onnx" khi không có GPU')
    ap.add_argument("--precision", default=None, help='mặc định fp32 trên CPU (khuyến nghị giữ nguyên)')
    ap.add_argument("--stretch", choices=["ffmpeg", "pyrubberband", "rubberband-cli", "atempo"], default=None)
    ap.add_argument("--aligner", choices=["whisperx", "whisper", "estimate", "none"], default="whisperx",
                    help="whisper = mốc từ của faster-whisper (cần --verify)")
    ap.add_argument("--device", default="cpu", help="thiết bị cho whisperX: cpu | cuda")
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="thư mục xuất (mặc định public/audio)")
    ap.add_argument("--list-voices", action="store_true", help="in danh sách giọng có sẵn của VieNeu rồi thoát")
    ap.add_argument("--verify", default=None, metavar="MODEL", help="nghe lại bằng faster-whisper (vd: medium), tạo lại tới 3 lần nếu lệch")
    ap.add_argument("--auto-approve", action="store_true", help="file khớp ASR → 'da_duyet' (kèm ghi chú để giáo viên nghe lại)")
    args = ap.parse_args()

    out_dir = Path(args.out).resolve()
    voices_cfg = json.loads(VOICES.read_text(encoding="utf-8"))
    engine = MockEngine() if args.engine == "mock" else VieneuEngine(args.backend, args.precision)

    if args.list_voices:
        for v in engine.list_voices():
            log(" •", v)
        log("\nNghe thử rồi ghi tên giọng vào scripts/voices.json (trường \"preset\").")
        return

    if args.engine == "mock" and out_dir == DEFAULT_OUT.resolve():
        sys.exit("Engine mock chỉ để kiểm thử – hãy dùng --out tới thư mục tạm, không ghi vào public/audio.")

    stretch = pick_stretch_method(args.stretch)
    log(f"[stretch] {stretch}")

    aligner = None
    if args.aligner == "whisperx":
        try:
            aligner = WhisperXAligner(args.device)
            log("[align] whisperX (vi)")
        except Exception as e:  # noqa: BLE001
            log(f"⚠️  Không dùng được whisperX ({e.__class__.__name__}: {e}). Chuyển sang ước lượng mốc thời gian.")
            args.aligner = "estimate"

    manifest_path = out_dir / "manifest.json"
    manifest = {"version": 1, "voices": {}, "entries": {}}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    voice_keys = args.voices.split(",") if args.voices else list(voices_cfg["voices"].keys())
    for vk in voice_keys:
        manifest["voices"][vk] = {"label": voices_cfg["voices"][vk]["label"]}

    items = collect_items()
    if args.only:
        wanted = set(args.only.split(","))
        items = [i for i in items if i["id"] in wanted]
    if args.limit:
        items = items[: args.limit]

    verifier = AsrVerifier(args.verify) if args.verify else None
    if verifier:
        log(f"[verify] faster-whisper {args.verify}")
    if args.aligner == "whisper":
        if not verifier:
            sys.exit("--aligner whisper cần --verify <model>")
        aligner = WhisperWordAligner(verifier)
        log("[align] faster-whisper word timestamps")
    tmp = Path(tempfile.mkdtemp(prefix="noichuan-", dir=TMP if TMP.exists() else None))
    made = skipped = failed = 0
    t0 = time.time()
    try:
        for vk in voice_keys:
            vcfg = voices_cfg["voices"][vk]
            synth_cfg = {k: vcfg.get(k) for k in ("preset", "ref_audio") if vcfg.get(k)}
            for n, it in enumerate(items, 1):
                key = f"{vk}/{it['id']}"
                name = safe_name(it["id"])
                slow_rel = f"/audio/{vk}/{name}.mp3"
                norm_rel = f"/audio/{vk}/normal/{name}.mp3"
                slow_abs = out_dir / vk / f"{name}.mp3"
                norm_abs = out_dir / vk / "normal" / f"{name}.mp3"
                h = content_hash(it["text"], synth_cfg, engine.name)
                old = manifest["entries"].get(key)
                if (not args.force and old and old.get("hash") == h and slow_abs.exists() and norm_abs.exists()):
                    skipped += 1
                    continue
                if old and old.get("source") == "human" and not args.force:
                    skipped += 1  # đã thay bằng ghi âm người thật – không ghi đè
                    continue
                log(f"[{vk} {n}/{len(items)}] {it['id']}: {it['text'][:60]}")
                try:
                    raw = tmp / f"{name}.wav"
                    slow = tmp / f"{name}_slow.wav"
                    carrier = needs_carrier(it["text"])
                    best = None
                    for attempt in range(2 if verifier else 1):
                        full = tmp / f"{name}_full.wav"
                        engine.synth(CARRIER + tts_text(it["text"]) if carrier else tts_text(it["text"]), vcfg, full)
                        report = verifier.check(it["text"], full, carrier) if verifier else None
                        if best is None or (report and report["acc"] > best[1]["acc"]):
                            shutil.copy(full, raw)
                            best = (attempt, report or {"acc": 0})
                        if not report or report["match"] != "mismatch":
                            break
                        log(f"   ↻ ASR nghe thành “{report['heard']}” – tạo lại")
                    asr_report = dict(best[1]) if verifier else None
                    st = asr_report.pop("start", None) if asr_report else None
                    cut_ok = False
                    if carrier and verifier:
                        if st is None or st <= 0.2:
                            st = verifier.word_start(raw, it["text"], len(clean_tokens(it["text"])))
                        if st is not None and st > 0.2:
                            run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{max(0.0, st - 0.06):.3f}", "-i", str(raw), str(tmp / f"{name}_cut.wav")])
                            cut_ok = duration_of(tmp / f"{name}_cut.wav") > 0.2
                    if carrier and not cut_ok:
                        cut_ok = cut_after_carrier(raw, tmp / f"{name}_cut.wav")
                    if carrier and not cut_ok:
                        log("   ⚠️ không cắt được câu đệm – đọc từ đứng riêng")
                        engine.synth(tts_text(it["text"]), vcfg, raw)
                        carrier = False
                    elif carrier:
                        shutil.move(tmp / f"{name}_cut.wav", raw)
                    time_stretch(raw, slow, stretch)
                    finalize_mp3(slow, slow_abs)
                    finalize_mp3(raw, norm_abs)
                    if aligner and (not isinstance(aligner, WhisperWordAligner) or len(clean_tokens(it["text"])) > 2):
                        try:
                            timings = aligner.align(it["text"], slow_abs)
                        except Exception as e:  # noqa: BLE001
                            log(f"   ⚠️ alignment lỗi ({e}); dùng ước lượng")
                            timings = align_estimate(it["text"], slow_abs)
                    elif args.aligner in ("estimate", "whisper"):
                        timings = align_estimate(it["text"], slow_abs)
                    else:
                        timings = []
                    manifest["entries"][key] = {
                        "id": it["id"],
                        "voice": vk,
                        "text": it["text"],
                        "slow": slow_rel,
                        "normal": norm_rel,
                        "durationSlow": duration_of(slow_abs),
                        "durationNormal": duration_of(norm_abs),
                        "timings": timings,
                        "hash": h,
                        "status": "chua_duyet",  # giáo viên duyệt trong trang quản trị
                        "source": "tts",
                        "carrier": carrier,
                    }
                    if asr_report:
                        entry = manifest["entries"][key]
                        entry["asr"] = asr_report
                        if asr_report["match"] == "mismatch":
                            entry["note"] = f"ASR nghe thành “{asr_report['heard']}” – cần nghe kiểm tra"
                        else:
                            entry["note"] = "Tự kiểm tra bằng ASR: khớp" + (" (s/x, ch/tr cần nghe tai)" if asr_report["match"] == "loose" else "")
                            if args.auto_approve:
                                entry["status"] = "da_duyet"
                    made += 1
                    if made % 10 == 0:  # lưu dần để không mất tiến độ
                        write_manifest(manifest_path, manifest)
                except Exception as e:  # noqa: BLE001
                    failed += 1
                    log(f"   ❌ {e}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        write_manifest(manifest_path, manifest)
    log(f"\nXong: tạo {made}, bỏ qua {skipped}, lỗi {failed} · {time.time() - t0:.0f}s · {manifest_path}")
    if failed:
        sys.exit(1)


def write_manifest(path: Path, manifest: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    manifest["generatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    manifest["entries"] = dict(sorted(manifest["entries"].items()))
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
