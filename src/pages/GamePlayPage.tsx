import { lazy, Suspense, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Instruction, PageHeader } from "@/components/common";
import { Mascot } from "@/components/Mascot";
import { gameById } from "@/lib/games";
import { pairs, promptText } from "@/lib/content";
import { celebrate } from "@/lib/fx";
import { nextDifficulty, recommendedPair } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { levelOf, useApp, useChild, useProgress } from "@/store/app";
import type { GameResult } from "@/components/games/shared";

const COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<import("@/components/games/shared").GameProps>>> = {
  "tai-thinh": lazy(() => import("@/components/games/TaiThinh")),
  "bong-bong": lazy(() => import("@/components/games/BongBong")),
  "duong-dua": lazy(() => import("@/components/games/DuongDua")),
  "thu-cung": lazy(() => import("@/components/games/ThuCung")),
  "doc-ve": lazy(() => import("@/components/games/DocVe")),
  "phan-loai": lazy(() => import("@/components/games/PhanLoai")),
  "bac-si": lazy(() => import("@/components/games/BacSi")),
  "guong-than": lazy(() => import("@/components/games/GuongThan")),
  truyen: lazy(() => import("@/components/games/Truyen")),
  "noi-nhanh": lazy(() => import("@/components/games/NoiNhanh")),
};

export default function GamePlayPage() {
  const { gameId = "" } = useParams();
  const game = gameById(gameId);
  const nav = useNavigate();
  const child = useChild()!;
  const progress = useProgress();
  const [pairId, setPairId] = useState<string | null>(() => recommendedPair(progress));
  const [phase, setPhase] = useState<"intro" | "play" | "end">("intro");
  const [result, setResult] = useState<GameResult | null>(null);
  const [round, setRound] = useState(0);
  const [t0, setT0] = useState(0);
  if (!game) return <Navigate to="/games" replace />;
  const level = levelOf(progress.xp).level;
  const locked = level < game.unlockLevel || (game.teenOnly && child.mode !== "teen");
  const difficulty = pairId ? (progress.difficulty[pairId] ?? 1) : 2;
  const Comp = COMPONENTS[game.id];

  const finish = (r: GameResult) => {
    const st = useApp.getState();
    st.completeSession({ kind: "game", activity: game.id, pairId: pairId ?? undefined, correct: r.correct, total: r.total, durationSec: Math.round((Date.now() - t0) / 1000), xp: r.xp });
    if (pairId) st.setDifficulty(pairId, nextDifficulty(difficulty, r.correct, r.total));
    setResult(r);
    setPhase("end");
    celebrate();
  };

  if (phase === "play")
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-4">
        <PageHeader title={game.title} close back="/games" />
        <Suspense fallback={<p className="text-muted-foreground">Đang tải…</p>}>
          <Comp key={round} pairId={pairId} difficulty={difficulty} onFinish={finish} />
        </Suspense>
      </div>
    );

  if (phase === "end" && result) {
    const ratio = result.total ? result.correct / result.total : 0;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
        <Mascot kind={child.mascot} mood="cheer" size={140} outfit={progress.pet.outfit} />
        <h1 className="mt-3 text-3xl font-extrabold">{result.note ?? "Hoàn thành!"}</h1>
        <div className="my-3 flex gap-1 text-4xl">
          {[1, 2, 3].map((k) => (
            <motion.span key={k} initial={{ scale: 0 }} animate={{ scale: k <= stars ? 1 : 0.7, opacity: k <= stars ? 1 : 0.25 }} transition={{ delay: 0.15 * k, type: "spring" }}>
              ⭐
            </motion.span>
          ))}
        </div>
        <p className="text-lg text-muted-foreground">
          Đúng {result.correct}/{result.total} · +{result.xp} XP
        </p>
        <div className="mt-8 grid w-full gap-2">
          <Button
            size="lg"
            onClick={() => {
              setRound((r) => r + 1);
              setT0(Date.now());
              setPhase("play");
            }}
          >
            <RotateCcw className="h-5 w-5" /> Chơi lại
          </Button>
          <Button variant="ghost" onClick={() => nav("/games")}>
            Kho trò chơi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-4">
      <PageHeader title={game.title} back="/games" />
      <div className={`relative flex flex-col items-center overflow-hidden rounded-[2rem] bg-gradient-to-br ${game.gradient} p-6 text-center text-white shadow-lift`}>
        <motion.span initial={{ scale: 0.5, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring" }} className="text-8xl">
          {game.emoji}
        </motion.span>
        <p className="mt-3 text-lg font-semibold text-white/90">{game.desc}</p>
        <p className="mt-1 text-sm text-white/75">{game.minutes}</p>
      </div>
      <Instruction className="mt-4" text={promptText(`game-${game.id}`)} promptId={`game-${game.id}`} />
      <p className="mb-2 mt-5 text-sm font-bold text-muted-foreground">Luyện cặp</p>
      <div className="grid grid-cols-4 gap-2">
        {[null, ...pairs.map((p) => p.id)].map((pid) => {
          const p = pairs.find((x) => x.id === pid);
          return (
            <button
              key={pid ?? "all"}
              onClick={() => setPairId(pid)}
              className={cn("rounded-2xl py-2.5 text-sm font-extrabold ring-2", pairId === pid ? (p ? `bg-${p.color}-soft text-${p.color}-ink ring-current` : "bg-primary-soft text-primary ring-current") : "bg-card ring-transparent")}
            >
              {p?.label ?? "Trộn"}
            </button>
          );
        })}
      </div>
      <div className="mt-auto pt-6">
        {locked ? (
          <Button size="lg" className="w-full" disabled>
            <Lock className="h-5 w-5" /> {game.teenOnly && child.mode !== "teen" ? "Dành cho chế độ Teen" : `Mở khóa ở cấp ${game.unlockLevel}`}
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              setT0(Date.now());
              setPhase("play");
            }}
          >
            <Play className="h-5 w-5 fill-current" /> Bắt đầu
          </Button>
        )}
      </div>
    </div>
  );
}
