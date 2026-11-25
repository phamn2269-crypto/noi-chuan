// Khung khẩu hình: 3D (tải lười) hoặc ảnh render sẵn trong /mouth khi không có WebGL / máy yếu / tốc độ khung hình thấp.
import { Component, lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Layers, ScanFace, Tag, Wind } from "lucide-react";
import { useApp } from "@/store/app";
import { isLowEndDevice, webglSupported } from "@/lib/device";
import { asset, cn } from "@/lib/utils";
import { phonemes } from "@/lib/content";
import type { MouthDriver } from "./three/driver";
import type { ViewMode } from "./three/VocalTract";

const MouthViewer = lazy(() => import("./three/MouthViewer"));

/** Nếu 3D gặp lỗi (driver đồ họa, mất ngữ cảnh WebGL...) → tự chuyển sang ảnh render sẵn. */
class ThreeBoundary extends Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function use3DMode() {
  const pref = useApp((s) => s.settings.render3d);
  const [lowFps, setLowFps] = useState(false);
  const use3d = pref === "3d" || (pref === "auto" && webglSupported() && !isLowEndDevice() && !lowFps);
  return { use3d, onLowPerformance: () => pref === "auto" && setLowFps(true) };
}

export function Mouth3D({
  driver,
  focus,
  className,
  compact,
  controls = true,
  defaultView = "side",
  title,
}: {
  driver: MouthDriver;
  focus?: string;
  className?: string;
  compact?: boolean;
  controls?: boolean;
  defaultView?: ViewMode;
  title?: string;
}) {
  const { use3d, onLowPerformance } = use3DMode();
  const [view, setView] = useState<ViewMode>(defaultView);
  const [air, setAir] = useState(true);
  const [labels, setLabels] = useState<"focus" | "all">("focus");
  useEffect(() => setView(defaultView), [defaultView]);

  return (
    <div className={cn("relative overflow-hidden rounded-3xl bg-[#13152b]", className)}>
      {use3d ? (
        <ThreeBoundary fallback={<MouthFallback driver={driver} view={view} focus={focus} />}>
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-white/70">Đang tải mô hình 3D…</div>}>
            <MouthViewer driver={driver} view={view} airflow={air} labels={labels} focus={focus} compact={compact} className="h-full w-full" onLowPerformance={onLowPerformance} />
          </Suspense>
        </ThreeBoundary>
      ) : (
        <MouthFallback driver={driver} view={view} focus={focus} />
      )}
      {title && <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-white backdrop-blur">{title}</div>}
      {controls && (
        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1">
          <div className="flex gap-1 rounded-2xl bg-black/35 p-1 backdrop-blur">
            {(
              [
                ["side", Layers, "Mặt cắt"],
                ["front", ScanFace, "Nhìn thẳng"],
                ["xray", Eye, "Xuyên thấu"],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn("flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold text-white/80", view === v && "bg-white text-slate-900")}
                aria-pressed={view === v}
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
                {!compact && <span className="hidden min-[400px]:inline">{label}</span>}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-2xl bg-black/35 p-1 backdrop-blur">
            <button onClick={() => setAir((a) => !a)} className={cn("rounded-xl p-1.5 text-white/80", air && "bg-cyan-300 text-slate-900")} aria-pressed={air} aria-label="Luồng hơi">
              <Wind className="h-4 w-4" />
            </button>
            <button onClick={() => setLabels((l) => (l === "all" ? "focus" : "all"))} className={cn("rounded-xl p-1.5 text-white/80", labels === "all" && "bg-white text-slate-900")} aria-pressed={labels === "all"} aria-label="Hiện tất cả nhãn">
              <Tag className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Ảnh khẩu hình render sẵn (scripts/render_mouth.mjs → public/mouth/<âm>_<chế độ>.webp), đổi theo âm đang phát. */
export function MouthFallback({ driver, view }: { driver: MouthDriver; view: ViewMode; focus?: string }) {
  const [pose, setPose] = useState(driver.currentPoseName());
  const staticPose = useSyncExternalStore((cb) => driver.subscribe(cb), () => driver.staticPose);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setPose(driver.currentPoseName());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [driver, staticPose]);
  const show = phonemes[pose] ? pose : "rest";
  return (
    <div className="relative h-full w-full">
      <AnimatePresence mode="popLayout">
        <motion.img
          key={`${show}_${view}`}
          src={asset(`mouth/${show}_${view}.webp`)}
          alt={`Khẩu hình âm ${phonemes[show]?.label ?? show}`}
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
        />
      </AnimatePresence>
      <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white/80">Chế độ ảnh (máy nhẹ)</span>
    </div>
  );
}
