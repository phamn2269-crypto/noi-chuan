// Kiểm tra đầu vào: đọc 15 từ → "bản đồ lỗi" dạng biểu đồ vòng cho từng cặp.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Instruction, ItemImage, PageHeader, Ring, pairColorVar } from "@/components/common";
import { MicButton } from "@/components/MicButton";
import { SpeakerButton } from "@/components/SpeakerButton";
import { FeedbackPanel } from "@/components/Feedback";
import { Mascot } from "@/components/Mascot";
import { usePractice } from "@/hooks/usePractice";
import { itemById, lessons, pairs, promptText } from "@/lib/content";
import type { WordItem } from "@/lib/types";
import { celebrate } from "@/lib/fx";
import { useApp, useChild } from "@/store/app";

export default function PlacementPage() {
  const nav = useNavigate();
  const child = useChild();
  const words = useMemo(() => lessons.placementTest.map((id) => itemById(id) as WordItem), []);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);
  const { setPlacement, setDifficulty, recordAttempt, completeSession } = useApp.getState();
  const [t0] = useState(Date.now());
  const pr = usePractice();
  const w = words[i];

  const next = (correct: boolean) => {
    const res = { ...results, [w.id]: correct };
    setResults(res);
    recordAttempt(w.id, w.pairId, correct, pr.result?.heard);
    pr.reset();
    if (i + 1 < words.length) setI(i + 1);
    else finish(res);
  };
  const finish = (res: Record<string, boolean>) => {
    const out: Record<string, { correct: number; total: number }> = {};
    for (const word of words) {
      const o = (out[word.pairId] ??= { correct: 0, total: 0 });
      o.total++;
      if (res[word.id]) o.correct++;
    }
    setPlacement(out);
    for (const [pid, o] of Object.entries(out)) setDifficulty(pid, o.correct / o.total >= 0.8 ? 2 : 1);
    const correct = Object.values(res).filter(Boolean).length;
    completeSession({ kind: "placement", activity: "placement", correct, total: words.length, durationSec: Math.round((Date.now() - t0) / 1000), xp: 30 });
    setDone(true);
    celebrate();
  };

  if (done) {
    const placement = useApp.getState().progress[useApp.getState().activeChildId!]?.placement;
    const weakest = pairs.slice().sort((a, b) => (placement?.results[a.id]?.correct ?? 0) / (placement?.results[a.id]?.total ?? 1) - (placement?.results[b.id]?.correct ?? 0) / (placement?.results[b.id]?.total ?? 1))[0];
    return (
      <div className="mx-auto max-w-md px-4 py-6">
        <PageHeader title="Bản đồ lỗi của con" subtitle="Vòng càng đầy = đọc càng chuẩn" />
        <div className="grid grid-cols-3 gap-3">
          {pairs.map((p) => {
            const r = placement?.results[p.id];
            const v = r ? r.correct / r.total : 0;
            return (
              <motion.div key={p.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`bento bg-grad-${p.color} flex flex-col items-center gap-2 p-3`}>
                <Ring value={v} size={78} stroke={9} color={pairColorVar(p.id)}>
                  <span className="text-base">{Math.round(v * 100)}%</span>
                </Ring>
                <span className={`text-sm font-extrabold text-${p.color}-ink`}>{p.label}</span>
                <span className="text-xs text-muted-foreground">
                  {r?.correct ?? 0}/{r?.total ?? 0} từ
                </span>
              </motion.div>
            );
          })}
        </div>
        <div className="bento mt-4 flex items-center gap-3 p-4">
          <Mascot kind={child?.mascot} mood="cheer" size={72} />
          <p className="font-semibold">
            Mình sẽ bắt đầu luyện <b className={`text-${weakest.color}-ink`}>{weakest.label}</b> trước nhé. Mỗi ngày chỉ 5–10 phút thôi!
          </p>
        </div>
        <Button size="lg" className="mt-6 w-full" onClick={() => nav("/")}>
          Về trang chủ <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-4">
      <PageHeader title="Kiểm tra đầu vào" subtitle={`Từ ${i + 1} / ${words.length}`} close back="/" />
      <Progress value={(i / words.length) * 100} />
      <Instruction className="mt-4" text={promptText("ui-placement")} promptId="ui-placement" />
      <AnimatePresence mode="wait">
        <motion.div key={w.id} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} className="bento mt-4 flex flex-col items-center gap-2 p-6">
          <ItemImage image={w.image} className="text-7xl" />
          <p className="text-5xl font-extrabold tracking-tight">{w.text}</p>
          <SpeakerButton id={w.id} label="Nghe mẫu" />
        </motion.div>
      </AnimatePresence>
      <div className="mt-4 min-h-[120px]">
        {pr.error && <p className="rounded-2xl bg-destructive/10 p-3 text-sm font-semibold">{pr.error}</p>}
        {pr.result && <FeedbackPanel result={pr.result} speakOut={false} onRetry={() => pr.reset()} onNext={() => next(pr.result!.correct)} onManual={(c) => next(c)} nextLabel="Từ tiếp theo" />}
      </div>
      <div className="mt-auto flex flex-col items-center pb-4">
        {!pr.result && <MicButton state={pr.state} level={pr.level} partial={pr.partial} onPress={() => pr.toggle(w.text)} label={pr.state === "recording" ? "Đang nghe… bấm để dừng" : "Bấm và đọc to"} />}
        <button className="mt-2 text-sm font-semibold text-muted-foreground underline" onClick={() => next(false)}>
          Bỏ qua từ này
        </button>
      </div>
    </div>
  );
}
