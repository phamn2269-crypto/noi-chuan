// Ghi âm + chấm điểm cho một văn bản mục tiêu. Dùng chung cho bài luyện và mọi trò chơi.
import { useCallback, useEffect, useRef, useState } from "react";
import { startRecording, micSupported, type RecorderHandle } from "@/lib/recorder";
import { scorePronunciation, type ScoreResult } from "@/lib/scoring";
import { stopAll } from "@/lib/audio";
import { useApp, useChild } from "@/store/app";

export type PracticeState = "idle" | "recording" | "scoring";

export function usePractice(opts: { maxMs?: number; onResult?: (r: ScoreResult) => void } = {}) {
  const child = useChild();
  const consent = useApp((s) => s.parent?.consentRecording ?? false);
  const [state, setState] = useState<PracticeState>("idle");
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handle = useRef<RecorderHandle | null>(null);
  const target = useRef("");
  const onResult = useRef(opts.onResult);
  onResult.current = opts.onResult;

  useEffect(() => () => handle.current?.stop(), []);

  const start = useCallback(
    async (text: string, maxMs?: number) => {
      if (!consent) {
        setError("Cần phụ huynh đồng ý thu âm trước khi luyện đọc.");
        return;
      }
      if (!micSupported()) {
        setError("Trình duyệt này không hỗ trợ micro.");
        return;
      }
      stopAll();
      setError(null);
      setResult(null);
      target.current = text;
      const words = text.split(/\s+/).length;
      try {
        handle.current = await startRecording({ maxMs: maxMs ?? opts.maxMs ?? Math.min(25000, 2500 + words * 900), onLevel: setLevel, silenceMs: words > 3 ? 1500 : 1000, wantBlob: !!import.meta.env.VITE_SCORING_API_URL });
        setState("recording");
        const rec = await handle.current.result;
        setState("scoring");
        const r = await scorePronunciation(rec, target.current, { mode: child?.mode });
        setResult(r);
        setState("idle");
        onResult.current?.(r);
      } catch (e) {
        setState("idle");
        setError((e as Error)?.name === "NotAllowedError" ? "Con cần cho phép dùng micro nhé (bố mẹ bật trong cài đặt trình duyệt)." : "Không bật được micro. Thử lại nhé!");
      }
    },
    [consent, child?.mode, opts.maxMs],
  );

  const stop = useCallback(() => handle.current?.stop(), []);
  const toggle = useCallback((text: string, maxMs?: number) => (state === "recording" ? stop() : state === "idle" ? start(text, maxMs) : undefined), [state, start, stop]);
  const reset = useCallback(() => setResult(null), []);
  /** Thiết bị không hỗ trợ nhận dạng: người lớn chấm tay. */
  const manualJudge = useCallback((correct: boolean) => {
    const r: ScoreResult = { status: "ok", score: correct ? 100 : 40, correct, wrongSound: null, targetSound: null, heard: "", errors: [], feedback: correct ? "Giỏi lắm! Con đọc chuẩn rồi." : "Con nghe lại mẫu và thử thêm lần nữa nhé!" };
    setResult(r);
    onResult.current?.(r);
  }, []);

  return { state, level, result, error, start, stop, toggle, reset, manualJudge, consent };
}
