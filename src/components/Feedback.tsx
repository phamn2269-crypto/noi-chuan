import { useEffect } from "react";
import { motion } from "framer-motion";
import { Check, RotateCcw, ScanFace, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Ring } from "@/components/common";
import { playItem } from "@/lib/audio";
import { feedbackFx } from "@/lib/fx";
import type { ScoreResult } from "@/lib/scoring";
import { cn } from "@/lib/utils";

/** Đọc góp ý bằng giọng (file mẫu đã duyệt hoặc Web Speech). */
export function speakFeedback(r: ScoreResult) {
  if (r.status === "retry") return playItem("ui-too-quiet");
  if (r.correct) return playItem("ui-correct");
  if (r.targetSound) return playItem(`hint-${r.targetSound}`);
  return playItem("ui-try-again");
}

export function FeedbackPanel({
  result,
  onRetry,
  onNext,
  onShowMouth,
  onManual,
  nextLabel = "Tiếp tục",
  speakOut = true,
}: {
  result: ScoreResult;
  onRetry?: () => void;
  onNext?: () => void;
  onShowMouth?: () => void;
  onManual?: (correct: boolean) => void;
  nextLabel?: string;
  speakOut?: boolean;
}) {
  useEffect(() => {
    if (result.status === "ok") feedbackFx(result.correct);
    if (speakOut && result.status !== "unsupported") speakFeedback(result);
  }, [result, speakOut]);

  if (result.status === "unsupported")
    return (
      <Panel tone="muted">
        <p className="font-semibold">{result.feedback}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="success" onClick={() => onManual?.(true)}>
            <ThumbsUp className="h-5 w-5" /> Con đọc đúng
          </Button>
          <Button variant="outline" onClick={() => onManual?.(false)}>
            <ThumbsDown className="h-5 w-5" /> Chưa đúng
          </Button>
        </div>
      </Panel>
    );

  if (result.status === "retry")
    return (
      <Panel tone="warning">
        <p className="font-semibold">{result.feedback}</p>
        <p className="mt-1 text-xs opacity-80">Lần này không tính điểm.</p>
        {onRetry && (
          <Button className="mt-3 w-full" onClick={onRetry}>
            <RotateCcw className="h-5 w-5" /> Đọc lại
          </Button>
        )}
      </Panel>
    );

  return (
    <Panel tone={result.correct ? "success" : "danger"}>
      <div className="flex items-center gap-3">
        <Ring value={result.score / 100} size={58} color={result.correct ? "hsl(var(--success))" : "hsl(var(--destructive))"}>
          {result.score}
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-lg font-extrabold">
            {result.correct ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />} {result.correct ? "Đúng rồi!" : "Chưa đúng"}
          </p>
          <p className="text-sm font-medium leading-snug">{result.feedback}</p>
          {result.heard && !result.correct && <p className="mt-1 text-xs opacity-75">Cô nghe được: “{result.heard}”</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!result.correct && onShowMouth && (
          <Button variant="secondary" size="sm" onClick={onShowMouth}>
            <ScanFace className="h-4 w-4" /> Xem khẩu hình
          </Button>
        )}
        {!result.correct && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" /> Thử lại
          </Button>
        )}
        {onNext && (
          <Button size="sm" className="ml-auto" onClick={onNext}>
            {nextLabel}
          </Button>
        )}
      </div>
    </Panel>
  );
}

function Panel({ tone, children }: { tone: "success" | "danger" | "warning" | "muted"; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={cn(
        "rounded-3xl p-4 shadow-soft",
        tone === "success" && "bg-success-soft text-success dark:text-success",
        tone === "danger" && "bg-destructive/10 text-foreground",
        tone === "warning" && "bg-warning-soft text-warning-foreground dark:text-warning",
        tone === "muted" && "bg-muted",
      )}
      role="status"
      aria-live="polite"
    >
      {children}
    </motion.div>
  );
}
