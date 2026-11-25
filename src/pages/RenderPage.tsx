// Trang nội bộ để render ảnh khẩu hình dự phòng (/mouth) bằng scripts/render_mouth.mjs.
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import MouthViewer from "@/components/three/MouthViewer";
import { MouthDriver } from "@/components/three/driver";
import type { ViewMode } from "@/components/three/VocalTract";

export default function RenderPage() {
  const [q] = useSearchParams();
  const pose = q.get("pose") ?? "rest";
  const view = (q.get("view") ?? "side") as ViewMode;
  const labels = (q.get("labels") ?? "focus") as "focus" | "all" | "none";
  const driver = useMemo(() => new MouthDriver(), []);
  useEffect(() => {
    const w = window as unknown as { __ready: boolean };
    if (q.get("anim")) {
      // video: nghỉ → tư thế → nghỉ
      driver.setPose("rest");
      setTimeout(() => driver.setPose(pose), 900);
      setTimeout(() => driver.setPose("rest"), 2400);
      setTimeout(() => (w.__ready = true), 3300);
    } else {
      driver.setPose(pose);
      setTimeout(() => (w.__ready = true), 2500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, pose]);
  return <MouthViewer driver={driver} view={view} airflow={q.get("air") !== "0"} labels={labels} focus={pose} className="h-screen w-screen" />;
}
