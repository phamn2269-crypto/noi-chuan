// Khối "đọc to và nhận điểm" dùng chung cho các trò chơi.
import { useState } from "react";
import { MicButton } from "@/components/MicButton";
import { FeedbackPanel } from "@/components/Feedback";
import { MouthDialog } from "@/components/MouthDialog";
import { usePractice } from "@/hooks/usePractice";
import type { ScoreResult } from "@/lib/scoring";
import { useApp } from "@/store/app";

export function ReadBlock({ text, itemId, pairId, sound, onScored, onNext, nextLabel, micLabel }: { text: string; itemId: string; pairId?: string; sound?: string; onScored?: (r: ScoreResult) => void; onNext: () => void; nextLabel?: string; micLabel?: string }) {
  const [mouth, setMouth] = useState(false);
  const pr = usePractice({
    onResult: (r) => {
      if (r.status !== "ok") return;
      useApp.getState().recordAttempt(itemId, pairId, r.correct, r.heard);
      onScored?.(r);
    },
  });
  const target = pr.result?.targetSound ?? sound;
  return (
    <>
      <div className="mt-3 min-h-[100px]">
        {pr.error && <p className="rounded-2xl bg-destructive/10 p-3 text-sm font-semibold">{pr.error}</p>}
        {pr.result && (
          <FeedbackPanel
            result={pr.result}
            onRetry={() => pr.reset()}
            onNext={() => {
              pr.reset();
              onNext();
            }}
            onShowMouth={target ? () => setMouth(true) : undefined}
            onManual={(c) => pr.manualJudge(c)}
            nextLabel={nextLabel}
          />
        )}
      </div>
      <div className="mt-auto flex justify-center">{(!pr.result || pr.result.status === "retry") && <MicButton state={pr.state} level={pr.level} onPress={() => pr.toggle(text)} label={micLabel ?? "Bấm và đọc"} />}</div>
      {target && <MouthDialog open={mouth} onOpenChange={setMouth} sound={target} wrongSound={pr.result?.wrongSound} />}
    </>
  );
}
