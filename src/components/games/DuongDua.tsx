// Đường Đua Phát Âm: xe chạy nhanh hơn khi đọc đúng, đua với linh vật.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Flag } from "lucide-react";
import { ItemImage } from "@/components/common";
import { MicButton } from "@/components/MicButton";
import { Mascot } from "@/components/Mascot";
import { SpeakerButton } from "@/components/SpeakerButton";
import { FeedbackPanel } from "@/components/Feedback";
import { usePractice } from "@/hooks/usePractice";
import { useApp, useChild } from "@/store/app";
import { gameWords, type GameProps } from "./shared";

const GOAL = 100;

export default function DuongDua({ pairId, difficulty, onFinish }: GameProps) {
  const child = useChild()!;
  const words = useMemo(() => gameWords(pairId, difficulty, 30), [pairId, difficulty]);
  const [i, setI] = useState(0);
  const [me, setMe] = useState(0);
  const [bot, setBot] = useState(0);
  const [running, setRunning] = useState(false);
  const [boost, setBoost] = useState(false);
  const stats = useRef({ correct: 0, total: 0 });
  const done = useRef(false);
  const botSpeed = 0.9 + difficulty * 0.35; // đơn vị / giây
  const w = words[i % words.length];

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setBot((b) => Math.min(GOAL, b + botSpeed * dt));
      setMe((m) => Math.min(GOAL, m + 0.25 * dt)); // xe vẫn lăn chậm
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, botSpeed]);

  useEffect(() => {
    if (done.current || !running) return;
    if (me >= GOAL || bot >= GOAL) {
      done.current = true;
      setRunning(false);
      const win = me >= GOAL;
      if (win) useApp.getState().awardBadge("racer");
      const { correct, total } = stats.current;
      onFinish({ correct, total, xp: 15 + correct * 5 + (win ? 25 : 0), note: win ? "Con thắng rồi! 🏆" : "Linh vật về trước – lần sau nhé!" });
    }
  }, [me, bot, running, onFinish]);

  const pr = usePractice({
    onResult: (r) => {
      if (r.status !== "ok") return;
      stats.current.total++;
      useApp.getState().recordAttempt(w.id, w.pairId, r.correct, r.heard);
      if (r.correct) {
        stats.current.correct++;
        setMe((m) => Math.min(GOAL, m + 14));
        setBoost(true);
        setTimeout(() => setBoost(false), 700);
        setTimeout(() => {
          pr.reset();
          setI((x) => x + 1);
        }, 700);
      } else setMe((m) => Math.min(GOAL, m + 3));
    },
  });

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-emerald-300 to-emerald-500 p-3 dark:from-emerald-800 dark:to-emerald-950">
        {[
          { pos: bot, who: "bot" as const },
          { pos: me, who: "me" as const },
        ].map(({ pos, who }) => (
          <div key={who} className="relative my-2 h-16 rounded-2xl bg-slate-700/90">
            <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 border-t-2 border-dashed border-white/50" />
            <Flag className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 text-white" />
            <motion.div className="absolute top-1/2 -translate-y-1/2" animate={{ left: `calc(${(pos / GOAL) * 84}% )` }} transition={{ type: "tween", duration: 0.15 }}>
              {who === "bot" ? (
                <div className="flex items-center">
                  <Mascot kind={child.mascot === "sao" ? "meo" : "sao"} size={46} />
                  <span className="-ml-2 text-3xl">🚙</span>
                </div>
              ) : (
                <motion.div animate={boost ? { x: [0, 10, 0], scale: [1, 1.15, 1] } : {}} className="flex items-center text-4xl">
                  🏎️{boost && <span className="text-xl">💨</span>}
                </motion.div>
              )}
            </motion.div>
          </div>
        ))}
        <p className="text-center text-xs font-bold text-white/90">Con 🏎️ · Linh vật 🚙</p>
      </div>
      {!running && !done.current ? (
        <button onClick={() => setRunning(true)} className="mt-6 rounded-3xl bg-primary py-4 text-xl font-extrabold text-white shadow-glow">
          3… 2… 1… Xuất phát!
        </button>
      ) : (
        <>
          <div className="bento mt-4 flex items-center gap-3 p-4">
            <ItemImage image={w.image} className="text-5xl" />
            <p className="flex-1 text-4xl font-extrabold">{w.text}</p>
            <SpeakerButton id={w.id} />
          </div>
          <div className="mt-3 min-h-[100px]">{pr.result && !pr.result.correct && <FeedbackPanel result={pr.result} onRetry={() => pr.reset()} onManual={(c) => pr.manualJudge(c)} speakOut={false} />}</div>
          <div className="mt-auto flex justify-center">
            {(!pr.result || !pr.result.correct) && <MicButton state={pr.state} level={pr.level} partial={pr.partial} onPress={() => (pr.result ? (pr.reset(), pr.toggle(w.text)) : pr.toggle(w.text))} label="Đọc để tăng tốc!" />}
          </div>
        </>
      )}
    </div>
  );
}
