// Gợi ý bài hôm nay + độ khó tự điều chỉnh.
import { pairs } from "./content";
import { GAMES } from "./games";
import type { Progress } from "@/store/app";
import { todayKey } from "./utils";

export function pairAccuracy(p: Progress, pairId: string) {
  const s = p.pairStats[pairId];
  if (s && s.a >= 5) return s.c / s.a;
  const pl = p.placement?.results[pairId];
  return pl ? pl.correct / pl.total : null;
}

/** Cặp yếu nhất (chưa luyện hôm nay được ưu tiên). */
export function recommendedPair(p: Progress, assignedPairId?: string) {
  if (assignedPairId) return assignedPairId;
  const today = todayKey();
  const doneToday = new Set(p.sessions.filter((s) => s.date === today && s.kind === "lesson").map((s) => s.pairId));
  const ranked = pairs.slice().sort((a, b) => (pairAccuracy(p, a.id) ?? 0.5) - (pairAccuracy(p, b.id) ?? 0.5));
  return (ranked.find((x) => !doneToday.has(x.id)) ?? ranked[0]).id;
}

export function suggestedGame(level: number, mode: "kid" | "teen") {
  const pool = GAMES.filter((g) => g.unlockLevel <= level && (!g.teenOnly || mode === "teen"));
  const d = new Date();
  return pool[(d.getDate() + d.getMonth()) % pool.length];
}

/** Điều chỉnh độ khó sau mỗi lượt: ≥ 85% → tăng, < 50% → giảm. */
export function nextDifficulty(current: number, correct: number, total: number) {
  if (!total) return current;
  const acc = correct / total;
  if (acc >= 0.85) return Math.min(3, current + 1);
  if (acc < 0.5) return Math.max(1, current - 1);
  return current;
}
