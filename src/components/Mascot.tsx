// Linh vật hoạt hình bằng SVG + Framer Motion (có thể thay bằng Lottie/Rive: giữ nguyên props kind/mood/outfit).
import { motion, useReducedMotion } from "framer-motion";
import type { MascotKind } from "@/store/app";
import { OUTFITS } from "@/store/app";

export type Mood = "idle" | "happy" | "sad" | "talk" | "think" | "cheer";

const PALETTE: Record<MascotKind, { body: string; belly: string; accent: string; name: string }> = {
  sao: { body: "#5b4cf0", belly: "#c9c3ff", accent: "#ffc83d", name: "Sáo Nhỏ" },
  meo: { body: "#ff9a52", belly: "#ffe0c4", accent: "#ff6f91", name: "Mèo Mướp" },
  rua: { body: "#2bb39a", belly: "#c8f2e6", accent: "#8a5a2b", name: "Rùa Chậm" },
  cun: { body: "#b98a5e", belly: "#f3dfc8", accent: "#5a3b22", name: "Cún Con" },
};
export const mascotName = (k: MascotKind) => PALETTE[k].name;

export function Mascot({ kind = "sao", mood = "idle", outfit, size = 120, className }: { kind?: MascotKind; mood?: Mood; outfit?: string | null; size?: number; className?: string }) {
  const p = PALETTE[kind];
  const reduce = useReducedMotion();
  const bounce = reduce
    ? {}
    : mood === "happy" || mood === "cheer"
      ? { y: [0, -14, 0], rotate: [0, -4, 4, 0], transition: { duration: 0.7, repeat: mood === "cheer" ? Infinity : 1 } }
      : mood === "sad"
        ? { y: 4, rotate: -3, transition: { duration: 0.4 } }
        : { y: [0, -4, 0], transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" as const } };
  const mouthOpen = mood === "talk" || mood === "happy" || mood === "cheer";
  return (
    <motion.svg viewBox="0 0 120 120" width={size} height={size} className={className} animate={bounce} role="img" aria-label={p.name}>
      {/* bóng */}
      <ellipse cx="60" cy="112" rx="30" ry="5" fill="black" opacity="0.08" />
      {/* tai / mào theo loại */}
      {kind === "meo" && (
        <>
          <path d="M30 40 L36 14 L52 32 Z" fill={p.body} />
          <path d="M90 40 L84 14 L68 32 Z" fill={p.body} />
          <path d="M36 34 L38 22 L46 31 Z" fill={p.accent} opacity="0.7" />
          <path d="M84 34 L82 22 L74 31 Z" fill={p.accent} opacity="0.7" />
        </>
      )}
      {kind === "cun" && (
        <>
          <ellipse cx="26" cy="52" rx="10" ry="20" fill={p.accent} transform="rotate(18 26 52)" />
          <ellipse cx="94" cy="52" rx="10" ry="20" fill={p.accent} transform="rotate(-18 94 52)" />
        </>
      )}
      {kind === "sao" && <path d="M58 12 C 52 2, 66 0, 62 14 C 70 6, 76 14, 64 18 Z" fill={p.body} />}
      {kind === "rua" && <ellipse cx="60" cy="74" rx="44" ry="34" fill={p.accent} opacity="0.9" />}
      {/* thân */}
      <ellipse cx="60" cy="66" rx="38" ry="42" fill={p.body} />
      <ellipse cx="60" cy="80" rx="24" ry="22" fill={p.belly} />
      {kind === "rua" && (
        <g opacity="0.25" fill="none" stroke="#063" strokeWidth="2">
          <path d="M42 76 l8 -10 h20 l8 10 l-8 10 h-20 z" />
        </g>
      )}
      {/* mắt (chớp mắt) */}
      <motion.g animate={reduce ? {} : { scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.92, 0.95, 1] }} style={{ originY: "52px" }}>
        <ellipse cx="46" cy="52" rx="9" ry="10" fill="white" />
        <ellipse cx="74" cy="52" rx="9" ry="10" fill="white" />
        <circle cx={mood === "think" ? 49 : 47} cy={mood === "think" ? 49 : 53} r="4.5" fill="#1d1b33" />
        <circle cx={mood === "think" ? 77 : 75} cy={mood === "think" ? 49 : 53} r="4.5" fill="#1d1b33" />
        <circle cx="48.5" cy="51" r="1.5" fill="white" />
        <circle cx="76.5" cy="51" r="1.5" fill="white" />
      </motion.g>
      {mood === "sad" && (
        <>
          <path d="M37 41 l14 4" stroke="#1d1b33" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M83 41 l-14 4" stroke="#1d1b33" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {/* má hồng */}
      <ellipse cx="36" cy="66" rx="6" ry="3.5" fill="#ff8fb1" opacity="0.6" />
      <ellipse cx="84" cy="66" rx="6" ry="3.5" fill="#ff8fb1" opacity="0.6" />
      {/* miệng / mỏ */}
      {kind === "sao" ? (
        <motion.path
          d={mouthOpen ? "M52 62 L60 58 L68 62 L60 74 Z" : "M52 62 L60 58 L68 62 L60 68 Z"}
          fill={p.accent}
          animate={mood === "talk" && !reduce ? { scaleY: [1, 1.35, 1] } : {}}
          transition={{ duration: 0.25, repeat: Infinity }}
          style={{ originY: "62px", originX: "60px" }}
        />
      ) : mouthOpen ? (
        <motion.ellipse
          cx="60"
          cy="68"
          rx="7"
          ry="5"
          fill="#7a2335"
          animate={mood === "talk" && !reduce ? { ry: [2, 6, 2] } : {}}
          transition={{ duration: 0.25, repeat: Infinity }}
        />
      ) : mood === "sad" ? (
        <path d="M52 71 Q60 64 68 71" stroke="#7a2335" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M52 66 Q60 73 68 66" stroke="#7a2335" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {kind === "meo" && (
        <g stroke="#1d1b33" strokeWidth="1.2" opacity="0.5">
          <path d="M28 64 h12 M28 69 l12 -2 M92 64 h-12 M92 69 l-12 -2" />
        </g>
      )}
      {/* trang phục */}
      {outfit && OUTFITS[outfit] && (
        <text x="60" y={outfit === "khan" ? 100 : outfit === "kinh" ? 60 : outfit === "no" ? 30 : 26} fontSize={outfit === "kinh" ? 30 : 34} textAnchor="middle" dominantBaseline="middle">
          {OUTFITS[outfit].emoji}
        </text>
      )}
    </motion.svg>
  );
}
