import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "@/store/app";
import { sfx } from "@/lib/fx";

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  useEffect(() => {
    if (!toasts.length) return;
    sfx.win();
    const t = setTimeout(() => dismiss(toasts[0].id), 3200);
    return () => clearTimeout(t);
  }, [toasts, dismiss]);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {toasts.slice(0, 1).map((t) => (
          <motion.button
            key={t.id}
            onClick={() => dismiss(t.id)}
            initial={{ y: -40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0 }}
            className="pointer-events-auto flex items-center gap-3 rounded-3xl bg-card px-4 py-3 shadow-lift ring-1 ring-border"
          >
            <span className="text-3xl">{t.emoji}</span>
            <span className="text-left">
              <span className="block text-xs font-semibold uppercase tracking-wide text-primary">{t.kind === "badge" ? "Huy hiệu mới" : t.kind === "level" ? "Cấp độ" : "Rương quà"}</span>
              <span className="block font-bold">{t.title}</span>
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
