// Nút loa: đọc to hướng dẫn / từ mẫu. Chế độ Nhí: mọi hướng dẫn đều có nút này.
import { useState } from "react";
import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { playItem, speak, type Speed } from "@/lib/audio";
import { cn } from "@/lib/utils";

export function SpeakerButton({ id, text, speed = "slow", className, size = "md", label }: { id?: string; text?: string; speed?: Speed; className?: string; size?: "sm" | "md" | "lg"; label?: string }) {
  const [busy, setBusy] = useState(false);
  const play = async () => {
    setBusy(true);
    const pb = id ? await playItem(id, { speed, text }) : await speak(text ?? "", speed);
    await pb.done;
    setBusy(false);
  };
  const dim = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11";
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      onClick={play}
      className={cn("inline-grid shrink-0 place-items-center rounded-full bg-primary-soft text-primary", dim, busy && "ring-4 ring-primary/25", className)}
      aria-label={label ?? "Nghe đọc"}
    >
      <Volume2 className={cn(size === "lg" ? "h-7 w-7" : "h-5 w-5", busy && "animate-pulse")} />
    </motion.button>
  );
}
