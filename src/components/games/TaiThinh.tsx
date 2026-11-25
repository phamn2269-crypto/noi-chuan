// Tai Thính: nghe một từ, chọn hình đúng trong 2 hình; đúng liên tiếp thì nhanh dần.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Volume2, Zap } from "lucide-react";
import { ItemImage } from "@/components/common";
import { Progress } from "@/components/ui/progress";
import { playItem } from "@/lib/audio";
import { feedbackFx } from "@/lib/fx";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { gamePairs, type GameProps } from "./shared";

const ROUNDS = 12;

export default function TaiThinh({ pairId, difficulty, onFinish }: GameProps) {
  const items = useMemo(() => gamePairs(pairId, difficulty, ROUNDS), [pairId, difficulty]);
  const [i, setI] = useState(0);
  const [truth, setTruth] = useState(() => Math.round(Math.random()));
  const [answer, setAnswer] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(1);
  const roundTime = Math.max(2.5, 7 - streak * 0.5 - (difficulty - 1) * 0.5); // nhanh dần
  const started = useRef(0);
  const item = items[i];

  useEffect(() => {
    if (!item) return;
    let raf = 0;
    const go = async () => {
      const pb = await playItem(`${item.id}#${truth}`);
      await pb.done;
      started.current = performance.now();
      const tick = () => {
        const left = 1 - (performance.now() - started.current) / 1000 / roundTime;
        setTimeLeft(Math.max(0, left));
        if (left <= 0) choose(-1);
        else raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    setTimeLeft(1);
    go();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const choose = (k: number) => {
    setAnswer((prev) => {
      if (prev !== null) return prev;
      const ok = k === truth;
      feedbackFx(ok);
      useApp.getState().recordAttempt(item.id, item.pairId, ok);
      const ns = ok ? streak + 1 : 0;
      setStreak(ns);
      setBest((b) => Math.max(b, ns));
      if (ok) setCorrect((c) => c + 1);
      if (ns >= 10) useApp.getState().awardBadge("sharp-ear");
      setTimeout(() => {
        if (i + 1 >= items.length) {
          useApp.getState().setRecord("tai-thinh-streak", Math.max(best, ns));
          onFinish({ correct: correct + (ok ? 1 : 0), total: items.length, xp: 10 + (correct + (ok ? 1 : 0)) * 4 });
        } else {
          setI(i + 1);
          setTruth(Math.round(Math.random()));
          setAnswer(null);
        }
      }, 900);
      return k;
    });
  };

  if (!item) return null;
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between text-sm font-bold">
        <span>
          Câu {i + 1}/{items.length}
        </span>
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-300">
          <Zap className="h-4 w-4" /> Chuỗi {streak}
        </span>
      </div>
      <Progress value={timeLeft * 100} className="mt-2" barClassName={cn(timeLeft < 0.3 ? "bg-destructive" : "bg-primary")} />
      <div className="my-6 flex justify-center">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => playItem(`${item.id}#${truth}`)} className="grid h-24 w-24 place-items-center rounded-full bg-primary text-white shadow-glow" aria-label="Nghe lại">
          <Volume2 className="h-10 w-10" />
        </motion.button>
      </div>
      <p className="mb-3 text-center text-lg font-bold">Cô vừa đọc từ nào?</p>
      <div className="grid grid-cols-2 gap-3">
        {item.options.map((o, k) => {
          const st = answer === null ? "" : k === truth ? "ring-success" : k === answer ? "ring-destructive" : "";
          return (
            <motion.button
              key={k}
              whileTap={{ scale: 0.94 }}
              animate={answer !== null && k === answer && k !== truth ? { x: [0, -8, 8, 0] } : {}}
              onClick={() => choose(k)}
              className={cn("bento flex aspect-square flex-col items-center justify-center gap-2 ring-4 ring-transparent", st)}
            >
              <ItemImage image={o.image} className="text-7xl" />
              <span className="text-2xl font-extrabold">{o.text}</span>
            </motion.button>
          );
        })}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">Đúng liên tiếp thì thời gian ngắn dần · {roundTime.toFixed(1)} giây</p>
    </div>
  );
}
