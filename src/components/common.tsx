import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { pairById } from "@/lib/content";
import type { ImageRef } from "@/lib/types";
import { useChild } from "@/store/app";
import { SpeakerButton } from "./SpeakerButton";

export function PageHeader({ title, subtitle, back, right, close }: { title: string; subtitle?: string; back?: string | boolean; right?: React.ReactNode; close?: boolean }) {
  const nav = useNavigate();
  return (
    <header className="mb-4 flex items-center gap-3">
      {(back || close) && (
        <button onClick={() => (typeof back === "string" ? nav(back) : nav(-1))} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card shadow-soft" aria-label={close ? "Thoát" : "Quay lại"}>
          {close ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

/** Hướng dẫn: chế độ Nhí luôn có nút loa đọc to. */
export function Instruction({ text, promptId, className }: { text: string; promptId?: string; className?: string }) {
  const child = useChild();
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {child?.mode !== "teen" && <SpeakerButton id={promptId} text={text} size="sm" label="Nghe hướng dẫn" />}
      <p className="font-semibold leading-snug">{text}</p>
    </div>
  );
}

export function ItemImage({ image, className }: { image?: ImageRef; className?: string }) {
  if (image?.src) return <img src={image.src} alt="" className={cn("object-contain", className)} />;
  return (
    <span className={cn("leading-none", className)} aria-hidden>
      {image?.emoji ?? "🔤"}
    </span>
  );
}

export function PairChip({ pairId, className }: { pairId: string; className?: string }) {
  const p = pairById(pairId);
  if (!p) return null;
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", `bg-${p.color}-soft text-${p.color}-ink`, className)}>{p.label}</span>;
}

/** Vòng tiến độ (SVG). */
export function Ring({ value, size = 56, stroke = 7, className, color = "hsl(var(--primary))", children }: { value: number; size?: number; stroke?: number; className?: string; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-bold">{children}</div>
    </div>
  );
}

export const pairColorVar = (pairId: string) => `hsl(var(--${pairById(pairId)?.color ?? "primary"}))`;

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      Nói Chuẩn chỉ hỗ trợ luyện phát âm, không thay thế chẩn đoán hay trị liệu. Nếu con gặp khó khăn kéo dài, bố mẹ nên đưa con gặp chuyên viên âm ngữ trị liệu.
    </p>
  );
}
