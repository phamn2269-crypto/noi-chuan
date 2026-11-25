import * as ProgressPrimitive from "@radix-ui/react-progress";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Thanh tiến độ chạy mượt (Framer Motion spring). */
export function Progress({ value = 0, className, barClassName, label = "Tiến độ" }: { value?: number; className?: string; barClassName?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <ProgressPrimitive.Root value={v} aria-label={label} className={cn("relative h-3 w-full overflow-hidden rounded-full bg-muted", className)}>
      <motion.div
        className={cn("h-full rounded-full bg-primary", barClassName)}
        initial={false}
        animate={{ width: `${v}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
      />
    </ProgressPrimitive.Root>
  );
}
