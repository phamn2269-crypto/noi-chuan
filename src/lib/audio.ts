// Phát giọng mẫu: file tĩnh do scripts/generate_audio.py tạo (public/audio). App KHÔNG gọi TTS trực tiếp.
//  - mặc định: bản 0,75 · "tốc độ thường": bản normal · "rùa": bản 0,75 với playbackRate 0.8 (≈ 0,6), giữ cao độ
//  - chỉ phát file "da_duyet" (manifest hoặc trạng thái duyệt của giáo viên); thiếu/chưa duyệt → Web Speech (vi-VN, 0.75)
import type { AudioManifest, ManifestEntry, TimingMark } from "./types";
import { textOf } from "./content";
import { estimateTimings, poseTrack, withPhonemes } from "./vietnamese";
import { useApp } from "@/store/app";
import { idbGet } from "./idb";
import { asset } from "./utils";

export type Speed = "slow" | "normal" | "turtle" | "half";

let manifestPromise: Promise<AudioManifest> | null = null;
export function loadManifest(): Promise<AudioManifest> {
  if (!manifestPromise)
    manifestPromise = fetch(asset("audio/manifest.json"))
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => m ?? { version: 1, voices: {}, entries: {} })
      .catch(() => ({ version: 1, voices: {}, entries: {} }));
  return manifestPromise;
}

export function reviewStatusOf(key: string, entry?: ManifestEntry) {
  const r = useApp.getState().admin.reviews[key];
  return r?.status ?? entry?.status ?? "chua_duyet";
}

export interface Playback {
  /** thời gian hiện tại trên thang của mốc (giây của bản 0,75) */
  clock: () => number;
  track: { t: number; pose: string }[];
  timings: TimingMark[];
  source: "file" | "human" | "speech" | "none";
  done: Promise<void>;
  stop: () => void;
}

let current: Playback | null = null;
export function stopAll() {
  current?.stop();
  current = null;
  try {
    speechSynthesis?.cancel();
  } catch {
    /* noop */
  }
}

function voiceOf(): string {
  const st = useApp.getState();
  return st.children.find((c) => c.id === st.activeChildId)?.voice ?? "bac";
}

let viVoice: SpeechSynthesisVoice | null | undefined;
function pickViVoice() {
  if (viVoice !== undefined) return viVoice;
  const vs = typeof speechSynthesis !== "undefined" ? speechSynthesis.getVoices() : [];
  viVoice = vs.find((v) => v.lang?.toLowerCase().startsWith("vi")) ?? null;
  if (!vs.length) viVoice = undefined; // danh sách giọng chưa tải xong
  return viVoice ?? null;
}
if (typeof speechSynthesis !== "undefined") speechSynthesis.onvoiceschanged = () => (viVoice = undefined);

export const speechAvailable = () => typeof speechSynthesis !== "undefined";

/** Phát một mục theo id (từ, cặp từ `id#0`, câu, vè, lời nhắc, gợi ý `hint-n`). */
export async function playItem(id: string, opts: { speed?: Speed; text?: string } = {}): Promise<Playback> {
  stopAll();
  const speed = opts.speed ?? "slow";
  const text = opts.text ?? textOf(id);
  const voice = voiceOf();
  const key = `${voice}/${id}`;
  const manifest = await loadManifest();
  const entry = manifest.entries[key];
  const review = useApp.getState().admin.reviews[key];

  // 1) ghi âm người thật do giáo viên tải lên
  if (review?.human) {
    const blob = await idbGet(`human/${key}`);
    if (blob) return playUrl(URL.createObjectURL(blob), speed, estimateTimings(text, 0.42), "human", true);
  }
  // 2) file TTS đã duyệt
  if (entry && reviewStatusOf(key, entry) === "da_duyet") {
    const url = asset(speed === "normal" ? entry.normal : entry.slow);
    const timings = entry.timings?.length ? withPhonemes(entry.timings) : estimateTimings(text);
    const scale = speed === "normal" ? (entry.durationNormal || 1) / (entry.durationSlow || 1) : 1;
    return playUrl(url, speed, timings, "file", false, scale);
  }
  // 3) dự phòng: Web Speech API
  useApp.getState().logMissingAudio(id);
  return speak(text, speed);
}

// Một trình phát dùng chung, "mở khóa" ở lần chạm đầu tiên: iOS Safari chặn audio.play() không nằm trong
// thao tác chạm, nhưng cho phép phát tiếp trên phần tử đã từng được phát bằng thao tác chạm.
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
let shared: HTMLAudioElement | null = null;
function sharedAudio() {
  if (!shared) shared = new Audio();
  return shared;
}
if (typeof window !== "undefined") {
  const unlock = () => {
    const a = sharedAudio();
    if (!a.src || a.src === SILENT) {
      a.src = SILENT;
      a.play().catch(() => {});
    }
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
  };
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
}

function playUrl(url: string, speed: Speed, timings: TimingMark[], source: Playback["source"], revoke: boolean, normalScale = 1): Promise<Playback> {
  const audio = sharedAudio();
  audio.pause();
  audio.src = url;
  audio.currentTime = 0;
  const rate = speed === "turtle" ? 0.8 : speed === "half" ? 0.5 : 1;
  audio.playbackRate = rate;
  (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));
  const finish = () => {
    resolveDone();
    if (revoke) URL.revokeObjectURL(url);
  };
  audio.onended = finish;
  audio.onerror = finish;
  const pb: Playback = {
    // khi phát bản thường, quy đổi thời gian về thang bản 0,75 để khớp mốc
    clock: () => audio.currentTime / normalScale,
    track: poseTrack(timings),
    timings,
    source,
    done,
    stop: () => {
      audio.pause();
      finish();
    },
  };
  current = pb;
  return audio
    .play()
    .then(() => pb)
    .catch(() => {
      finish();
      return pb;
    });
}

/** Đọc bằng Web Speech API (vi-VN, tốc độ 0.75). Dùng cho dự phòng và câu góp ý động. */
export function speak(text: string, speed: Speed = "slow"): Promise<Playback> {
  const rate = speed === "normal" ? 1 : speed === "turtle" ? 0.6 : speed === "half" ? 0.5 : 0.75;
  const secPerSyl = 0.32 / rate;
  const timings = estimateTimings(text, secPerSyl);
  let start = 0;
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));
  const pb: Playback = {
    clock: () => (start ? (performance.now() - start) / 1000 : 0),
    track: poseTrack(timings),
    timings,
    source: speechAvailable() ? "speech" : "none",
    done,
    stop: () => {
      try {
        speechSynthesis.cancel();
      } catch {
        /* noop */
      }
      resolveDone();
    },
  };
  current = pb;
  if (!speechAvailable()) {
    // không có giọng đọc: vẫn chạy mô hình 3D theo mốc ước lượng
    start = performance.now();
    const total = (timings[timings.length - 1]?.end ?? 1) * 1000;
    setTimeout(resolveDone, total);
    return Promise.resolve(pb);
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "vi-VN";
  u.rate = rate;
  const v = pickViVoice();
  if (v) u.voice = v;
  u.onstart = () => (start = performance.now());
  u.onend = () => resolveDone();
  u.onerror = () => resolveDone();
  start = performance.now();
  speechSynthesis.speak(u);
  // một số trình duyệt không gọi onend – chặn treo
  setTimeout(resolveDone, ((timings[timings.length - 1]?.end ?? 2) * 1000) / Math.max(rate, 0.5) + 3000);
  return Promise.resolve(pb);
}

/** Trạng thái âm thanh của một mục (cho trang quản trị). */
export async function audioInfo(id: string, voice: string) {
  const m = await loadManifest();
  const key = `${voice}/${id}`;
  const entry = m.entries[key];
  const review = useApp.getState().admin.reviews[key];
  return { key, entry, status: reviewStatusOf(key, entry), human: !!review?.human, note: review?.note };
}
