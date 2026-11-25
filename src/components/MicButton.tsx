// Nút micro lớn, tròn, có vòng sóng âm động theo âm lượng thật khi thu.
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export function MicButton({
  state,
  level,
  onPress,
  disabled,
  size = 84,
  label,
  partial,
}: {
  state: "idle" | "recording" | "scoring";
  level: number;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  label?: string;
  /** chữ nhận dạng tạm thời khi đang thu */
  partial?: string;
}) {
  const reduce = useReducedMotion();
  const rec = state === "recording";
  const lv = Math.min(1, level * 1.4);
  return (
    <div className="relative flex flex-col items-center gap-2">
      {rec && partial && (
        <p className="max-w-[18rem] text-center text-sm font-semibold text-primary" aria-live="polite">
          Cô đang nghe: “{partial}”
        </p>
      )}
      <div className="relative grid place-items-center" style={{ width: size * 1.9, height: size * 1.9 }}>
        {rec &&
          [0.55, 0.85, 1.15].map((k, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full bg-primary/20"
              style={{ width: size, height: size }}
              animate={{ scale: 1 + lv * k + (reduce ? 0 : 0.05), opacity: 0.55 - i * 0.15 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            />
          ))}
        {rec && !reduce && (
          <motion.span
            className="absolute rounded-full border-2 border-primary/40"
            style={{ width: size, height: size }}
            animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
        )}
        <motion.button
          type="button"
          onClick={onPress}
          disabled={disabled || state === "scoring"}
          whileTap={{ scale: 0.9 }}
          className={cn(
            "relative z-10 grid place-items-center rounded-full text-white shadow-glow transition-colors disabled:opacity-60",
            rec ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: size, height: size }}
          aria-label={rec ? "Dừng thu âm" : "Bấm để đọc"}
        >
          {state === "scoring" ? <Loader2 className="h-9 w-9 animate-spin" /> : rec ? <Square className="h-8 w-8 fill-current" /> : <Mic className="h-10 w-10" />}
        </motion.button>
      </div>
      {label && <p className="-mt-6 text-sm font-semibold text-muted-foreground">{label}</p>}
    </div>
  );
}
