// Bong Bóng Âm: bong bóng chứa từ bay lên; đọc đúng từ nào thì bong bóng đó nổ. Micro nghe liên tục.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MicButton } from "@/components/MicButton";
import { usePractice } from "@/hooks/usePractice";
import { playItem } from "@/lib/audio";
import { sfx, feedbackFx } from "@/lib/fx";
import { hintFor } from "@/lib/feedbackText";
import { parseSyllable, stripDiacritics, syllables } from "@/lib/vietnamese";
import { useApp } from "@/store/app";
import type { WordItem } from "@/lib/types";
import { gameWords, type GameProps } from "./shared";

interface Bubble {
  key: number;
  word: WordItem;
  x: number; // %
  born: number;
  dur: number; // giây bay hết màn hình
  hue: number;
}
const TOTAL = 14;

export default function BongBong({ pairId, difficulty, onFinish }: GameProps) {
  const words = useMemo(() => gameWords(pairId, difficulty, TOTAL), [pairId, difficulty]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [spawned, setSpawned] = useState(0);
  const [popped, setPopped] = useState(0);
  const [missed, setMissed] = useState(0);
  const [msg, setMsg] = useState<string>("Bấm micro để bắt đầu, rồi đọc từ trong bong bóng!");
  const [now, setNow] = useState(performance.now());
  const [live, setLive] = useState(false);
  const bubblesRef = useRef<Bubble[]>([]);
  bubblesRef.current = bubbles;
  const ended = useRef(false);
  const speed = 13 - difficulty * 2; // giây

  const end = useCallback(
    (p: number) => {
      if (ended.current) return;
      ended.current = true;
      if (p >= 20) useApp.getState().awardBadge("bubble-pop");
      onFinish({ correct: p, total: TOTAL, xp: 10 + p * 5, note: `Nổ ${p} bong bóng!` });
    },
    [onFinish],
  );

  // sinh bong bóng
  useEffect(() => {
    if (!live || spawned >= words.length) return;
    const t = setTimeout(
      () => {
        setBubbles((b) => [...b, { key: spawned, word: words[spawned], x: 8 + Math.random() * 64, born: performance.now(), dur: speed + Math.random() * 2, hue: Math.floor(Math.random() * 360) }]);
        setSpawned((s) => s + 1);
      },
      spawned === 0 ? 300 : 2600,
    );
    return () => clearTimeout(t);
  }, [live, spawned, words, speed]);

  // vòng thời gian + bong bóng thoát
  useEffect(() => {
    if (!live) return;
    let raf = 0;
    const loop = () => {
      const t = performance.now();
      setNow(t);
      const escaped = bubblesRef.current.filter((b) => (t - b.born) / 1000 > b.dur);
      if (escaped.length) {
        setBubbles((bs) => bs.filter((b) => !escaped.includes(b)));
        setMissed((m) => m + escaped.length);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [live]);

  useEffect(() => {
    if (live && spawned >= words.length && bubbles.length === 0) end(popped);
  }, [live, spawned, words.length, bubbles.length, popped, end]);

  const pr = usePractice({
    maxMs: 6000,
    onResult: (r) => {
      if (r.status === "unsupported") {
        setMsg("Thiết bị chưa nhận dạng được giọng nói – chạm vào bong bóng sau khi đọc to.");
        return;
      }
      const heardAll = (r.heard ? [r.heard] : []).flatMap((h) => syllables(h));
      let hit = 0;
      let swapMsg = "";
      for (const b of bubblesRef.current) {
        const target = syllables(b.word.text);
        const ok = target.every((s) => heardAll.includes(s));
        if (ok) {
          hit++;
          pop(b, true);
        } else {
          // phát hiện đọc nhầm âm đầu
          const t0 = target[0];
          const tp = parseSyllable(t0);
          const swapped = heardAll.find((h) => {
            const hp = parseSyllable(h);
            return hp.onset === b.word.confusableSound && stripDiacritics(hp.rest) === stripDiacritics(tp.rest);
          });
          if (swapped) swapMsg = `“${b.word.text}” chứ không phải “${swapped}”. ${hintFor(b.word.targetSound)}!`;
        }
      }
      if (hit) {
        feedbackFx(true);
        setMsg(hit > 1 ? `Nổ ${hit} bong bóng!` : "Bụp! Giỏi quá!");
      } else if (swapMsg) {
        feedbackFx(false);
        setMsg(swapMsg);
      } else if (r.status === "retry") setMsg(r.feedback);
      else setMsg("Chưa trúng bong bóng nào, đọc lại nhé!");
      // nghe tiếp (rảnh tay)
      if (!ended.current) setTimeout(() => !ended.current && listen(), 350);
    },
  });
  const listen = () => pr.start(bubblesRef.current.map((b) => b.word.text).join(" ") || "a", 6000);

  const pop = (b: Bubble, scored: boolean) => {
    sfx.pop();
    setBubbles((bs) => bs.filter((x) => x.key !== b.key));
    if (scored) setPopped((p) => p + 1);
    useApp.getState().recordAttempt(b.word.id, b.word.pairId, scored);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex justify-between text-sm font-bold">
        <span>🫧 Nổ: {popped}</span>
        <span className="text-muted-foreground">Bay mất: {missed}</span>
        <span>
          {spawned}/{TOTAL}
        </span>
      </div>
      <div className="relative mt-2 h-[52dvh] min-h-[320px] overflow-hidden rounded-3xl bg-gradient-to-b from-sky-200 to-sky-50 dark:from-sky-950 dark:to-indigo-950">
        <AnimatePresence>
          {bubbles.map((b) => {
            const prog = Math.min(1, (now - b.born) / 1000 / b.dur);
            return (
              <motion.button
                key={b.key}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => (pr.result?.status === "unsupported" ? pop(b, true) : playItem(b.word.id))}
                className="absolute grid h-24 w-24 place-items-center rounded-full text-center font-extrabold text-slate-900"
                style={{
                  left: `${b.x}%`,
                  bottom: `calc(${prog * 100}% - 96px)`,
                  background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,.95), hsla(${b.hue},90%,75%,.75) 45%, hsla(${b.hue},80%,60%,.55))`,
                  boxShadow: `inset -6px -8px 16px hsla(${b.hue},80%,45%,.35), 0 8px 20px rgba(0,0,0,.12)`,
                }}
                aria-label={`Bong bóng ${b.word.text}`}
              >
                <span className="text-2xl leading-none">{b.word.image.emoji}</span>
                <span className="-mt-3 text-lg">{b.word.text}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
      <p className="mt-3 min-h-[3rem] text-center font-semibold">{pr.error ?? msg}</p>
      <div className="mt-auto flex justify-center">
        <MicButton
          state={pr.state}
          level={pr.level}
          partial={pr.partial}
          onPress={() => {
            if (!live) setLive(true);
            if (pr.state === "recording") pr.stop();
            else listen();
          }}
          label={pr.state === "recording" ? "Đang nghe…" : live ? "Bấm để nghe tiếp" : "Bắt đầu"}
        />
      </div>
    </div>
  );
}
