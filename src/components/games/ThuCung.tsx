// Nuôi Thú Cưng: mỗi từ đọc đúng là một phần thức ăn; thú lớn lên, mở khóa trang phục.
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ItemImage } from "@/components/common";
import { MicButton } from "@/components/MicButton";
import { Mascot } from "@/components/Mascot";
import { SpeakerButton } from "@/components/SpeakerButton";
import { FeedbackPanel } from "@/components/Feedback";
import { Progress } from "@/components/ui/progress";
import { usePractice } from "@/hooks/usePractice";
import { OUTFITS, petStage, useApp, useChild, useProgress } from "@/store/app";
import { cn } from "@/lib/utils";
import { gameWords, type GameProps } from "./shared";

const ROUNDS = 8;
const FOODS = ["🍎", "🥕", "🍌", "🌽", "🍓", "🥦", "🍙", "🧀"];
const STAGE_NEED = [0, 12, 30, 60];
const STAGE_OUTFIT: Record<number, string> = { 2: "no", 3: "nonla", 4: "vuongmien" };

export default function ThuCung({ pairId, difficulty, onFinish }: GameProps) {
  const child = useChild()!;
  const progress = useProgress();
  const words = useMemo(() => gameWords(pairId, difficulty, ROUNDS), [pairId, difficulty]);
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [eating, setEating] = useState<string | null>(null);
  const food = progress.pet.food;
  const stage = petStage(food);
  const w = words[i];

  const pr = usePractice({
    onResult: (r) => {
      if (r.status !== "ok") return;
      const st = useApp.getState();
      st.recordAttempt(w.id, w.pairId, r.correct, r.heard);
      if (r.correct) {
        setCorrect((c) => c + 1);
        const before = petStage(st.progress[st.activeChildId!].pet.food);
        st.feedPet(1);
        const after = petStage(st.progress[st.activeChildId!].pet.food);
        if (after > before && STAGE_OUTFIT[after]) st.unlockOutfit(STAGE_OUTFIT[after]);
        setEating(FOODS[i % FOODS.length]);
        setTimeout(() => setEating(null), 900);
      }
    },
  });
  const next = () => {
    pr.reset();
    if (i + 1 >= words.length) onFinish({ correct, total: words.length, xp: 10 + correct * 6, note: `Thú cưng được ăn ${correct} phần!` });
    else setI(i + 1);
  };
  const need = STAGE_NEED[Math.min(stage, 3)] ?? 60;
  const prev = STAGE_NEED[stage - 1] ?? 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="bento relative flex flex-col items-center overflow-hidden bg-gradient-to-b from-amber-50 to-card p-4 dark:from-amber-950/40">
        <div className="flex w-full items-center justify-between text-sm font-bold">
          <span>Cấp {stage}</span>
          <span>
            🍽️ {food}
            {stage < 4 ? `/${need}` : ""}
          </span>
        </div>
        <Progress value={stage >= 4 ? 100 : ((food - prev) / (need - prev)) * 100} className="mt-1" barClassName="bg-amber-400" />
        <div className="relative mt-2 h-44 w-full">
          <motion.div className="absolute inset-x-0 bottom-0 flex justify-center" animate={{ scale: 0.7 + stage * 0.12 }} style={{ originY: 1 }}>
            <Mascot kind={child.mascot} mood={eating ? "happy" : pr.state === "recording" ? "think" : "idle"} outfit={progress.pet.outfit} size={130} />
          </motion.div>
          <AnimatePresence>
            {eating && (
              <motion.span key="f" initial={{ y: -60, x: 60, opacity: 1, scale: 1.2 }} animate={{ y: 40, x: 0, opacity: 0, scale: 0.4 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="absolute left-1/2 top-0 text-4xl">
                {eating}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="mt-2 flex gap-1.5">
          <button onClick={() => useApp.getState().setPetOutfit(null)} className={cn("h-9 rounded-full px-3 text-xs font-bold", !progress.pet.outfit ? "bg-primary text-white" : "bg-muted")}>
            Không
          </button>
          {Object.entries(OUTFITS).map(([k, o]) => {
            const owned = progress.pet.unlocked.includes(k);
            return (
              <button
                key={k}
                disabled={!owned}
                onClick={() => useApp.getState().setPetOutfit(k)}
                className={cn("grid h-9 w-9 place-items-center rounded-full text-lg", progress.pet.outfit === k ? "bg-primary" : "bg-muted", !owned && "opacity-30 grayscale")}
                aria-label={owned ? o.label : `${o.label} (chưa mở)`}
              >
                {owned ? o.emoji : "🔒"}
              </button>
            );
          })}
        </div>
      </div>
      <div className="bento mt-3 flex items-center gap-3 p-4">
        <ItemImage image={w.image} className="text-5xl" />
        <p className="flex-1 text-4xl font-extrabold">{w.text}</p>
        <SpeakerButton id={w.id} />
      </div>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Từ {i + 1}/{words.length}
      </p>
      <div className="mt-2 min-h-[100px]">{pr.result && <FeedbackPanel result={pr.result} onRetry={() => pr.reset()} onNext={next} onManual={(c) => pr.manualJudge(c)} />}</div>
      <div className="mt-auto flex justify-center">{(!pr.result || pr.result.status === "retry") && <MicButton state={pr.state} level={pr.level} onPress={() => pr.toggle(w.text)} label="Đọc để cho thú ăn" />}</div>
    </div>
  );
}
