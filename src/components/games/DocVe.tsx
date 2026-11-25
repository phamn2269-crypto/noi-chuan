// Đọc Vè – Đố Vui: chữ chạy kiểu karaoke theo mốc thời gian giọng mẫu; con đọc từng dòng và được chấm.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Eye, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MicButton } from "@/components/MicButton";
import { FeedbackPanel } from "@/components/Feedback";
import { usePractice } from "@/hooks/usePractice";
import { playItem, speak, stopAll } from "@/lib/audio";
import { versesOf } from "@/lib/content";
import { normalizeText } from "@/lib/vietnamese";
import { cn, shuffle } from "@/lib/utils";
import { useApp } from "@/store/app";
import { activePairs, type GameProps } from "./shared";

export default function DocVe({ pairId, onFinish }: GameProps) {
  const verse = useMemo(() => shuffle(activePairs(pairId).flatMap((p) => versesOf(p.id)))[0], [pairId]);
  const words = useMemo(() => verse.lines.map((l) => l.split(/\s+/)), [verse]);
  const flat = useMemo(() => words.flatMap((ws, li) => ws.map((w, wi) => ({ li, wi, w }))), [words]);
  const [mode, setMode] = useState<"listen" | "read" | "answer">("listen");
  const [hi, setHi] = useState(-1); // chỉ số âm tiết đang sáng (toàn bài)
  const [line, setLine] = useState(0);
  const [lineResults, setLineResults] = useState<Record<number, { correct: boolean; bad: Set<string> }>>({});
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  useEffect(() => () => (cancelAnimationFrame(raf.current), stopAll()), []);

  const listen = async () => {
    setPlaying(true);
    const pb = await playItem(verse.id);
    const timings = pb.timings;
    const loop = () => {
      const t = pb.clock();
      let k = -1;
      for (let i = 0; i < timings.length; i++) if (t >= timings[i].start) k = i;
      setHi(k);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    await pb.done;
    cancelAnimationFrame(raf.current);
    setHi(flat.length);
    setPlaying(false);
  };

  // khi con đọc: chữ chạy theo nhịp ước lượng để dẫn đường
  const guideStart = () => {
    const first = flat.findIndex((f) => f.li === line);
    const n = words[line].length;
    const t0 = performance.now();
    const loop = () => {
      const k = Math.min(n, Math.floor((performance.now() - t0) / 560));
      setHi(first + k);
      if (k < n) raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  const pr = usePractice({
    onResult: (r) => {
      cancelAnimationFrame(raf.current);
      if (r.status !== "ok") return;
      const bad = new Set(r.errors.map((e) => e.expected));
      setLineResults((lr) => ({ ...lr, [line]: { correct: r.correct, bad } }));
      useApp.getState().recordAttempt(`${verse.id}:${line}`, verse.pairId, r.correct, r.heard);
    },
  });

  const nextLine = () => {
    pr.reset();
    setHi(-1);
    if (line + 1 < words.length) setLine(line + 1);
    else {
      useApp.getState().awardBadge("verse-reader");
      if (verse.subtype === "cau_do") setMode("answer");
      else finish();
    }
  };
  const finish = () => {
    const correct = Object.values(lineResults).filter((x) => x.correct).length;
    onFinish({ correct, total: words.length, xp: 20 + correct * 8, note: verse.title });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">{verse.subtype === "cau_do" ? "Câu đố" : verse.subtype === "ca_dao" ? "Ca dao" : "Vè"}</span>
        <span className="text-sm font-bold text-muted-foreground">{verse.title}</span>
      </div>
      <div className="bento mt-3 space-y-2 p-5">
        {words.map((ws, li) => (
          <p key={li} className={cn("text-2xl font-bold leading-relaxed transition-opacity", mode === "read" && li !== line && "opacity-35")}>
            {ws.map((w, wi) => {
              const idx = flat.findIndex((f) => f.li === li && f.wi === wi);
              const lit = idx <= hi;
              const res = lineResults[li];
              const bad = res?.bad.has(normalizeText(w));
              return (
                <motion.span
                  key={wi}
                  animate={{ scale: idx === hi ? 1.12 : 1 }}
                  className={cn("mr-1.5 inline-block rounded-lg px-0.5 transition-colors", res ? (bad ? "bg-destructive/15 text-destructive" : "text-success") : lit ? "text-primary" : "text-foreground/70")}
                >
                  {w}
                </motion.span>
              );
            })}
          </p>
        ))}
      </div>
      {mode === "listen" && (
        <div className="mt-auto grid gap-2 pt-4">
          <Button variant="secondary" size="lg" onClick={playing ? () => (stopAll(), setPlaying(false)) : listen}>
            {playing ? <Square className="h-5 w-5" /> : <Play className="h-5 w-5" />} {playing ? "Dừng" : "Nghe cô đọc mẫu"}
          </Button>
          <Button size="lg" onClick={() => (stopAll(), setHi(-1), setMode("read"))}>
            Con đọc từng dòng
          </Button>
        </div>
      )}
      {mode === "read" && (
        <>
          <div className="mt-3 min-h-[100px]">
            {pr.error && <p className="rounded-2xl bg-destructive/10 p-3 text-sm font-semibold">{pr.error}</p>}
            {pr.result && <FeedbackPanel result={pr.result} onRetry={() => (pr.reset(), setLineResults((lr) => ({ ...lr, [line]: undefined as never })))} onNext={nextLine} onManual={(c) => pr.manualJudge(c)} nextLabel={line + 1 < words.length ? "Dòng tiếp" : "Xong"} />}
          </div>
          <div className="mt-auto flex justify-center">
            {(!pr.result || pr.result.status === "retry") && (
              <MicButton
                state={pr.state}
                level={pr.level}
                partial={pr.partial}
                onPress={() => {
                  if (pr.state === "idle") guideStart();
                  pr.toggle(verse.lines[line]);
                }}
                label={`Đọc dòng ${line + 1}/${words.length}`}
              />
            )}
          </div>
        </>
      )}
      {mode === "answer" && (
        <div className="mt-4 flex flex-col items-center gap-3 text-center">
          <AnswerReveal answer={verse.answer ?? ""} emoji={verse.answerEmoji ?? "❓"} />
          <Button size="lg" className="w-full" onClick={finish}>
            Hoàn thành
          </Button>
        </div>
      )}
    </div>
  );
}

function AnswerReveal({ answer, emoji }: { answer: string; emoji: string }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bento w-full p-5">
      <div className="text-7xl">{emoji}</div>
      <p className="mt-2 text-2xl font-extrabold">{answer}</p>
    </motion.div>
  ) : (
    <Button
      variant="soft"
      size="lg"
      className="w-full"
      onClick={() => {
        setOpen(true);
        speak(`Đáp án là: ${answer}`);
      }}
    >
      <Eye className="h-5 w-5" /> Con đoán xong chưa? Xem đáp án
    </Button>
  );
}
