import type { ErrorPair } from "@/lib/types";
import { pairs, wordsOf, minimalPairsOf } from "@/lib/content";
import { shuffle } from "@/lib/utils";
import { useApp } from "@/store/app";

export interface GameResult {
  correct: number;
  total: number;
  xp: number;
  note?: string;
}
export interface GameProps {
  pairId: string | null; // null = trộn tất cả cặp
  difficulty: number;
  onFinish: (r: GameResult) => void;
}

export const activePairs = (pairId: string | null): ErrorPair[] => (pairId ? pairs.filter((p) => p.id === pairId) : pairs);

/** Từ cho trò chơi theo độ khó (bỏ mục giáo viên đã ẩn). */
export function gameWords(pairId: string | null, difficulty: number, n: number) {
  const hidden = useApp.getState().admin.hiddenItems;
  const pool = activePairs(pairId).flatMap((p) => wordsOf(p.id)).filter((w) => w.difficulty <= difficulty + 1 && !hidden.includes(w.id));
  const out = shuffle(pool);
  while (out.length < n && pool.length) out.push(...shuffle(pool));
  return out.slice(0, n);
}
export function gamePairs(pairId: string | null, difficulty: number, n: number) {
  const hidden = useApp.getState().admin.hiddenItems;
  const pool = activePairs(pairId).flatMap((p) => minimalPairsOf(p.id)).filter((m) => m.difficulty <= difficulty + 1 && !hidden.includes(m.id));
  const out = shuffle(pool);
  while (out.length < n && pool.length) out.push(...shuffle(pool));
  return out.slice(0, n);
}

/** Kiểm tra transcript có chứa từ mục tiêu (đúng nguyên âm tiết) không. */
export { syllables } from "@/lib/vietnamese";
