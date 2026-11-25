// Nhãn tiếng Việt nổi trên mô hình: lớp DOM phủ lên canvas, vị trí chiếu từ mốc 3D mỗi khung hình
// (không dùng drei <Html> để tránh tạo nhiều React root).
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { partLabels } from "@/lib/content";
import type { TractState } from "./VocalTract";

export const ALL_LABELS = ["tongue_tip", "tongue_blade", "tongue_root", "alveolar_ridge", "hard_palate", "soft_palate", "uvula", "nasal_cavity", "pharynx", "epiglottis", "lip_upper", "lip_lower", "teeth_upper", "jaw"];

export function labelNames(highlight: string[], showAll: boolean) {
  return showAll ? Array.from(new Set([...ALL_LABELS, ...highlight])) : highlight;
}

/** Trong Canvas: chiếu mốc 3D → tọa độ màn hình và cập nhật style của các nhãn DOM. */
export function LabelProjector({ stateRef, els, parent }: { stateRef: React.MutableRefObject<TractState | null>; els: React.MutableRefObject<Record<string, HTMLDivElement | null>>; parent: React.RefObject<THREE.Object3D | null> }) {
  const { camera, size } = useThree();
  const v = new THREE.Vector3();
  useFrame(() => {
    const lm = stateRef.current?.landmarks;
    for (const [name, el] of Object.entries(els.current)) {
      if (!el) continue;
      const p = lm?.[name];
      if (!p) {
        el.style.opacity = "0";
        continue;
      }
      v.copy(p);
      if (parent.current) v.applyMatrix4(parent.current.matrixWorld);
      v.project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      el.style.opacity = visible ? "1" : "0";
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`;
    }
  });
  return null;
}

/** Ngoài Canvas: các nhãn DOM. */
export function LabelOverlay({ names, highlight, els, compact }: { names: string[]; highlight: string[]; els: React.MutableRefObject<Record<string, HTMLDivElement | null>>; compact?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {names.map((n) => {
        const active = highlight.includes(n);
        return (
          <div
            key={n}
            ref={(el) => {
              if (el) els.current[n] = el;
              else delete els.current[n];
            }}
            className="absolute left-0 top-0 opacity-0 transition-opacity"
          >
            {active && <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_12px_4px_rgba(126,240,255,.7)]" />}
            <span
              className={
                "absolute -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded-full px-2.5 py-1 font-semibold shadow-lg " +
                (compact ? "text-[10px] " : "text-xs ") +
                (active ? "bg-cyan-300 text-slate-900 ring-2 ring-white/70" : "bg-slate-900/75 text-white/90")
              }
            >
              {partLabels[n] ?? n}
            </span>
          </div>
        );
      })}
    </div>
  );
}
