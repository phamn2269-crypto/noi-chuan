// Tải sẵn âm thanh của giọng đang dùng + gương mặt 3D vào bộ nhớ đệm (service worker lưu theo CacheFirst).
import { loadManifest } from "./audio";
import { asset } from "./utils";
import { headUrl } from "@/components/three/RealHead";

export async function prefetchForOffline(voice: string, headKind: string | null, onProgress: (done: number, total: number) => void) {
  const m = await loadManifest();
  const urls: string[] = [];
  for (const [key, e] of Object.entries(m.entries)) {
    if (!key.startsWith(voice + "/")) continue;
    urls.push(asset(e.slow), asset(e.normal));
  }
  if (headKind) urls.push(headUrl(headKind));
  let done = 0;
  const queue = urls.slice();
  const worker = async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      try {
        await fetch(u, { cache: "reload" });
      } catch {
        /* bỏ qua – lần sau thử lại */
      }
      onProgress(++done, urls.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return urls.length;
}
