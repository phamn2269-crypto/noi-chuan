// Phát hiện khả năng thiết bị để chọn 3D hay ảnh/video render sẵn.
let webgl: boolean | null = null;
export function webglSupported(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement("canvas");
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webgl = false;
  }
  return webgl;
}

export function isLowEndDevice(): boolean {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (n.hardwareConcurrency && n.hardwareConcurrency <= 2) return true;
  if (n.deviceMemory && n.deviceMemory <= 2) return true;
  if (n.connection?.saveData) return true;
  return false;
}

export const prefersReducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

let glbCheck: Promise<boolean> | null = null;
/** Kiểm tra đã có mô hình thật /models/vocal_tract.glb chưa (dev server trả index.html cho file thiếu). */
export function hasRealModel(): Promise<boolean> {
  if (!glbCheck)
    glbCheck = fetch(import.meta.env.BASE_URL + "models/vocal_tract.glb", { method: "HEAD" })
      .then((r) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html"))
      .catch(() => false);
  return glbCheck;
}
