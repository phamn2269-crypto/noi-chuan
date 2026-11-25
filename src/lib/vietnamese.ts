// Tiện ích ngữ âm tiếng Việt: chuẩn hóa, tách âm tiết, tách phụ âm đầu, chuỗi tư thế khẩu hình.
import type { TimingMark } from "./types";

const ONSETS = ["ngh", "ng", "nh", "ch", "tr", "th", "ph", "kh", "gh", "gi", "qu", "b", "c", "d", "đ", "g", "h", "k", "l", "m", "n", "p", "r", "s", "t", "v", "x"];

/** Bỏ dấu thanh và dấu phụ: "nước" -> "nuoc", "đ" -> "d". */
export function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

/** Chỉ bỏ dấu thanh, giữ dấu phụ âm (ă, â, ê, ô, ơ, ư): "nước" -> "nươc". */
export function stripTone(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̣̀́̃̉]/g, "")
    .normalize("NFC");
}

export function normalizeText(s: string) {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,!?;:"“”'‘’()\-–—…]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const syllables = (s: string) => normalizeText(s).split(" ").filter(Boolean);

export function parseSyllable(syl: string): { onset: string; rest: string } {
  const s = syl.normalize("NFC").toLowerCase();
  for (const o of ONSETS) {
    if (s.startsWith(o)) {
      // "gi" + phụ âm (gìn, giếng) – vẫn coi gi là phụ âm đầu
      return { onset: o, rest: s.slice(o.length) };
    }
  }
  return { onset: "", rest: s };
}

export const onsetOf = (syl: string) => parseSyllable(syl).onset;

/** Đổi phụ âm đầu: swapOnset("nón", "n", "l") -> "lón". */
export function swapOnset(syl: string, from: string, to: string) {
  const { onset, rest } = parseSyllable(syl);
  return onset === from ? to + rest : syl;
}

/** Tạo dạng "đọc ngọng" của cả cụm/câu: thay mọi âm tiết có phụ âm đầu `from` thành `to`. */
export function mispronounce(text: string, from: string, to: string) {
  return syllables(text)
    .map((s) => swapOnset(s, from, to))
    .join(" ");
}

// ---------- Âm tiết -> chuỗi tư thế (viseme) ----------
const ONSET_POSE: Record<string, string> = {
  b: "m", p: "m", m: "m", ph: "v", v: "v",
  t: "t", th: "t", "đ": "t", d: "x", gi: "x",
  n: "n", nh: "n", l: "l", s: "s", x: "x", ch: "ch", tr: "tr", r: "r",
  c: "rest", k: "rest", q: "rest", qu: "u", kh: "rest", g: "rest", gh: "rest", ng: "rest", ngh: "rest", h: "rest",
};
const CODA_POSE: [RegExp, string][] = [
  [/ng$/, "rest"], [/nh$/, "i"], [/ch$/, "i"], [/m$/, "m"], [/p$/, "m"], [/n$/, "n"], [/t$/, "t"], [/c$/, "rest"],
  [/[iy]$/, "i"], [/[ou]$/, "u"],
];
function vowelPose(ch: string): string | null {
  const b = stripDiacritics(ch);
  if ("a".includes(b)) return "a";
  if ("ei".includes(b) || b === "y") return "i";
  if (b === "o") return "o";
  if (b === "u") return "u";
  return null;
}

export interface VisemeKey {
  pose: string;
  weight: number; // tỉ lệ thời lượng trong âm tiết
}

export function syllableVisemes(syl: string): VisemeKey[] {
  const { onset, rest } = parseSyllable(syl);
  const out: VisemeKey[] = [];
  if (onset) out.push({ pose: ONSET_POSE[onset] ?? "rest", weight: 0.32 });
  // nguyên âm: lấy tối đa 2 nguyên âm đầu tiên (âm chính / âm đệm)
  const restNoTone = stripTone(rest);
  let coda = "";
  const vowels: string[] = [];
  for (let i = 0; i < restNoTone.length; i++) {
    const p = vowelPose(restNoTone[i]);
    if (p) vowels.push(p);
    else {
      coda = restNoTone.slice(i);
      break;
    }
  }
  // bán âm cuối i/y/o/u được tính là coda
  if (!coda && vowels.length >= 2 && /[iyou]$/.test(stripDiacritics(restNoTone))) {
    coda = restNoTone.slice(-1);
    vowels.pop();
  }
  const uniqV = vowels.filter((v, i) => v !== vowels[i - 1]).slice(0, 2);
  if (uniqV.length === 0) uniqV.push("a");
  uniqV.forEach((v) => out.push({ pose: v, weight: 0.48 / uniqV.length }));
  if (coda) {
    const hit = CODA_POSE.find(([re]) => re.test(coda));
    if (hit) out.push({ pose: hit[1], weight: 0.2 });
  }
  return out;
}

/** Ước lượng mốc thời gian âm tiết khi chưa có forced-alignment (giọng 0,75). */
export function estimateTimings(text: string, secPerSyllable = 0.5): TimingMark[] {
  const tokens = text.normalize("NFC").split(/\s+/).filter(Boolean);
  let t = 0.08;
  const marks: TimingMark[] = [];
  for (const tok of tokens) {
    const syl = normalizeText(tok);
    if (!syl) continue;
    const dur = secPerSyllable * (0.8 + Math.min(syl.length, 6) * 0.05);
    marks.push({ start: t, end: t + dur, text: syl });
    t += dur;
    if (/[.,!?;:]$/.test(tok)) t += 0.3;
  }
  return withPhonemes(marks);
}

/** Bổ sung mốc tư thế cho từng âm tiết (nếu manifest chưa có). */
export function withPhonemes(marks: TimingMark[]): TimingMark[] {
  return marks.map((m) => {
    if (m.phonemes?.length) return m;
    const keys = syllableVisemes(m.text);
    let t = m.start;
    const dur = m.end - m.start;
    return {
      ...m,
      phonemes: keys.map((k) => {
        const s = t;
        t += dur * k.weight;
        return { start: s, end: t, pose: k.pose };
      }),
    };
  });
}

/** Chuỗi tư thế phẳng: [{t, pose}] dùng để điều khiển mô hình 3D. */
export function poseTrack(marks: TimingMark[]) {
  const track: { t: number; pose: string }[] = [{ t: 0, pose: "rest" }];
  for (const m of withPhonemes(marks)) for (const p of m.phonemes ?? []) track.push({ t: p.start, pose: p.pose });
  const last = marks[marks.length - 1];
  if (last) track.push({ t: last.end + 0.05, pose: "rest" });
  return track;
}

/** Khoảng cách Levenshtein giữa 2 dãy. */
export function levenshtein<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean = (x, y) => x === y) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (eq(a[i - 1], b[j - 1]) ? 0 : 1));
  return dp[a.length][b.length];
}
