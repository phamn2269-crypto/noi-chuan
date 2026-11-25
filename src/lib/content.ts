import lessonsJson from "@data/lessons.json";
import phonemesJson from "@data/phonemes.json";
import type { ErrorPair, LessonItem, LessonsFile, MinimalPairItem, PhonemesFile, SentenceItem, VerseItem, WordItem } from "./types";

export const lessons = lessonsJson as unknown as LessonsFile;
export const phonemeData = phonemesJson as unknown as PhonemesFile;
export const phonemes = phonemeData.phonemes;
export const partLabels = phonemeData.parts;

export const pairs: ErrorPair[] = lessons.errorPairs.filter((p) => p.enabled).sort((a, b) => a.order - b.order);
export const pairById = (id: string) => pairs.find((p) => p.id === id);

const byId = new Map<string, LessonItem>(lessons.items.map((i) => [i.id, i]));
export const itemById = (id: string) => byId.get(id);
export const promptText = (id: string) => lessons.prompts.find((p) => p.id === id)?.text ?? "";

export const wordsOf = (pairId?: string) =>
  lessons.items.filter((i): i is WordItem => i.type === "word" && (!pairId || i.pairId === pairId));
export const minimalPairsOf = (pairId?: string) =>
  lessons.items.filter((i): i is MinimalPairItem => i.type === "minimal_pair" && (!pairId || i.pairId === pairId));
export const sentencesOf = (pairId?: string) =>
  lessons.items.filter((i): i is SentenceItem => i.type === "sentence" && (!pairId || i.pairId === pairId));
export const versesOf = (pairId?: string) =>
  lessons.items.filter((i): i is VerseItem => i.type === "verse" && (!pairId || i.pairId === pairId));

/** Văn bản cần đọc của một mục (dùng cho âm thanh/chấm điểm). Với cặp từ, dùng id con `${id}#0|#1`. */
export function textOf(id: string): string {
  const [base, sub] = id.split("#");
  if (base.startsWith("hint-")) return hintSpeech(base.slice(5));
  const story = lessons.stories.find((st) => base.startsWith(st.id + "-"));
  if (story) return story.pages[Number(base.slice(story.id.length + 1)) - 1]?.text ?? "";
  const it = byId.get(base);
  if (!it) return lessons.prompts.find((p) => p.id === id)?.text ?? "";
  if (it.type === "minimal_pair") return it.options[Number(sub ?? 0)]?.text ?? "";
  return it.text;
}

/** Tất cả khóa âm thanh cần có (khớp với scripts/generate_audio.py). */
export function allAudioIds(): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  for (const it of lessons.items) {
    if (it.type === "minimal_pair") it.options.forEach((o, k) => out.push({ id: `${it.id}#${k}`, text: o.text }));
    else out.push({ id: it.id, text: it.text });
  }
  for (const p of lessons.prompts) out.push({ id: p.id, text: p.text });
  for (const st of lessons.stories) st.pages.forEach((pg, k) => out.push({ id: `${st.id}-${k + 1}`, text: pg.text }));
  for (const [k, ph] of Object.entries(phonemeData.phonemes))
    if (k !== "rest" && ph.kidHint) out.push({ id: `hint-${k}`, text: hintSpeech(k) });
  return out;
}

export const pairColor = (pairId: string) => pairById(pairId)?.color ?? "ln";

/** Câu gợi ý khẩu hình đọc thành tiếng (khớp với generate_audio.py: kidHint + " nhé!"). */
export function hintSpeech(phoneme: string) {
  const h = phonemeData.phonemes[phoneme]?.kidHint ?? "";
  return h.replace(/[.!]+$/, "") + " nhé!";
}
export const storiesOf = (pairId?: string) => lessons.stories.filter((s) => !pairId || s.pairId === pairId);
