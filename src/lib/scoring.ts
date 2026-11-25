// Module chấm phát âm – thay mô hình dễ dàng: chỉ cần giữ chữ ký scorePronunciation(audio, targetText).
//  1) Nếu có VITE_SCORING_API_URL: gửi audio + văn bản tới API chấm phát âm hỗ trợ vi-VN.
//  2) Nếu không: dùng nhận dạng giọng nói tiếng Việt (Web Speech) rồi so sánh với văn bản mục tiêu,
//     phát hiện lỗi đổi phụ âm đầu (l↔n, ch↔tr, s↔x...).
import { pairs } from "./content";
import { hintFor } from "./feedbackText";
import { levenshtein, parseSyllable, stripDiacritics, syllables } from "./vietnamese";
import type { RecordingResult } from "./recorder";

export interface ScoreResult {
  status: "ok" | "retry" | "unsupported";
  score: number; // 0..100
  correct: boolean;
  /** âm con đã đọc nhầm sang (vd "l" khi mục tiêu là "n") */
  wrongSound: string | null;
  /** âm đúng cần sửa */
  targetSound: string | null;
  heard: string;
  feedback: string;
  /** âm tiết đọc sai: [{expected, heard}] */
  errors: { expected: string; heard: string }[];
}

const CONFUSABLE = new Set(pairs.flatMap((p) => [`${p.sounds[0]}>${p.sounds[1]}`, `${p.sounds[1]}>${p.sounds[0]}`]));
const isConfusion = (a: string, b: string) => CONFUSABLE.has(`${a}>${b}`);

const PRAISE = ["Giỏi lắm! Con đọc chuẩn rồi.", "Tuyệt vời! Đúng rồi con ạ.", "Hay quá! Con đọc rất rõ.", "Chính xác! Cô khen con."];
const PRAISE_TEEN = ["Chuẩn rồi!", "Rất tốt!", "Chính xác!", "Đúng rồi, rõ ràng!"];

function sylSim(expected: string, heard: string): { sim: number; swap?: [string, string] } {
  if (expected === heard) return { sim: 1 };
  const e = parseSyllable(expected);
  const h = parseSyllable(heard);
  const eRest = stripDiacritics(e.rest);
  const hRest = stripDiacritics(h.rest);
  if (e.onset !== h.onset && eRest === hRest && isConfusion(e.onset, h.onset)) return { sim: 0.2, swap: [e.onset, h.onset] };
  if (stripDiacritics(expected) === stripDiacritics(heard)) return { sim: 0.85 }; // chỉ khác thanh/dấu – thường do nhận dạng
  const d = levenshtein([...expected], [...heard]);
  return { sim: Math.max(0, 1 - d / Math.max(expected.length, heard.length)) };
}

/** Căn hai dãy âm tiết bằng quy hoạch động, trả về các cặp đã khớp. */
function align(exp: string[], got: string[]) {
  const n = exp.length;
  const m = got.length;
  const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const back: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) (cost[i][0] = i), (back[i][0] = 1);
  for (let j = 1; j <= m; j++) (cost[0][j] = j * 0.6), (back[0][j] = 2);
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const sub = cost[i - 1][j - 1] + (1 - sylSim(exp[i - 1], got[j - 1]).sim);
      const del = cost[i - 1][j] + 1;
      const ins = cost[i][j - 1] + 0.6;
      const best = Math.min(sub, del, ins);
      cost[i][j] = best;
      back[i][j] = best === sub ? 0 : best === del ? 1 : 2;
    }
  const pairsOut: { e: string; h: string | null }[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const b = back[i][j];
    if (i > 0 && j > 0 && b === 0) {
      pairsOut.unshift({ e: exp[i - 1], h: got[j - 1] });
      i--;
      j--;
    } else if (i > 0 && (j === 0 || b === 1)) {
      pairsOut.unshift({ e: exp[i - 1], h: null });
      i--;
    } else j--;
  }
  return pairsOut;
}

function evaluate(target: string, transcript: string) {
  const exp = syllables(target);
  const got = syllables(transcript);
  const al = align(exp, got);
  let total = 0;
  const errors: { expected: string; heard: string }[] = [];
  let swap: [string, string] | undefined;
  for (const { e, h } of al) {
    if (h === null) {
      errors.push({ expected: e, heard: "…" });
      continue;
    }
    const s = sylSim(e, h);
    total += s.sim;
    if (s.sim < 0.85) errors.push({ expected: e, heard: h });
    if (s.swap && !swap) swap = s.swap;
  }
  const score = Math.round((100 * total) / Math.max(1, exp.length));
  return { score, errors, swap };
}

export interface ScoreOptions {
  mode?: "kid" | "teen";
}

export async function scorePronunciation(audio: RecordingResult, targetText: string, opts: ScoreOptions = {}): Promise<ScoreResult> {
  const base = { wrongSound: null, targetSound: null, errors: [], heard: "" } as const;
  // Ồn hoặc quá nhỏ: nhắc đọc lại, không trừ điểm
  if (audio.peak < 0.08 || audio.speechMs < 150) {
    return { ...base, errors: [], status: "retry", score: 0, correct: false, feedback: "Cô chưa nghe rõ. Con đọc to hơn một chút nhé!" };
  }

  const api = import.meta.env.VITE_SCORING_API_URL as string | undefined;
  if (api && audio.blob) {
    try {
      const fd = new FormData();
      fd.append("audio", audio.blob, "speech.webm");
      fd.append("text", targetText);
      fd.append("lang", "vi-VN");
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 1800);
      const r = await fetch(api, { method: "POST", body: fd, signal: ctrl.signal });
      clearTimeout(to);
      if (r.ok) {
        const j = (await r.json()) as { score?: number; transcript?: string; wrongSound?: string };
        if (j.transcript) return fromTranscripts([j.transcript], targetText, opts);
        if (typeof j.score === "number")
          return { ...base, errors: [], status: "ok", score: j.score, correct: j.score >= 80, wrongSound: j.wrongSound ?? null, feedback: j.score >= 80 ? PRAISE[0] : "Con thử đọc lại chậm hơn nhé!" };
      }
    } catch {
      /* rơi xuống nhận dạng trên trình duyệt */
    }
  }

  if (!audio.srSupported) {
    return { ...base, errors: [], status: "unsupported", score: 0, correct: false, feedback: "Thiết bị này chưa hỗ trợ nhận dạng giọng nói. Bố mẹ/thầy cô nghe và chấm giúp con nhé." };
  }
  if (!audio.transcripts.length) {
    const fb = audio.srError === "network" ? "Cần kết nối mạng để nhận dạng giọng nói. Con thử lại nhé!" : "Cô chưa nghe rõ. Con đọc lại nhé!";
    return { ...base, errors: [], status: "retry", score: 0, correct: false, feedback: fb };
  }
  return fromTranscripts(audio.transcripts, targetText, opts);
}

function fromTranscripts(transcripts: string[], targetText: string, opts: ScoreOptions): ScoreResult {
  // chọn phương án nhận dạng khớp nhất
  let best = { t: transcripts[0], ...evaluate(targetText, transcripts[0]) };
  for (const t of transcripts.slice(1)) {
    const r = evaluate(targetText, t);
    if (r.score > best.score) best = { t, ...r };
  }
  // Nếu phương án tốt nhất vẫn có lỗi đổi âm thì giữ; nếu phương án số 1 (tin cậy nhất) có đổi âm mà điểm gần bằng → ưu tiên báo lỗi
  const first = evaluate(targetText, transcripts[0]);
  if (first.swap && first.score >= best.score - 10) best = { t: transcripts[0], ...first };

  const correct = best.score >= 80 && !best.swap;
  const kid = opts.mode !== "teen";
  let feedback: string;
  if (correct) feedback = (kid ? PRAISE : PRAISE_TEEN)[Math.floor(Math.random() * 4)];
  else if (best.swap) {
    const [expected] = best.swap;
    const err = best.errors.find((e) => parseSyllable(e.expected).onset === expected) ?? best.errors[0];
    feedback = kid
      ? `Con đọc "${err?.expected}" thành "${err?.heard}" rồi. ${hintFor(expected, "kid")} nhé!`
      : `Bạn đọc "${err?.expected}" thành "${err?.heard}". ${hintFor(expected, "teen")}`;
  } else if (best.score >= 60) feedback = kid ? "Gần đúng rồi! Con nghe lại và đọc chậm từng tiếng nhé." : "Gần đúng. Nghe lại và đọc chậm, rõ từng tiếng.";
  else feedback = kid ? "Con nghe cô đọc lại rồi thử thêm lần nữa nhé!" : "Chưa khớp. Nghe mẫu và thử lại.";

  return {
    status: "ok",
    score: best.score,
    correct,
    wrongSound: best.swap?.[1] ?? null,
    targetSound: best.swap?.[0] ?? null,
    heard: best.t,
    feedback,
    errors: best.errors,
  };
}
