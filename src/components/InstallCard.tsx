// Gợi ý cài "Nói Chuẩn" lên màn hình chính (PWA). Android/Chrome: hộp thoại cài đặt chính thức;
// iPhone/iPad (Safari): hướng dẫn Chia sẻ → Thêm vào MH chính. Ẩn khi đã chạy như app.
import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
}

const isStandalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const DISMISS_KEY = "noi-chuan-install-dismissed";

export function InstallCard() {
  const [, force] = useState(0);
  const [iosHelp, setIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const f = () => force((x) => x + 1);
    listeners.add(f);
    return () => void listeners.delete(f);
  }, []);
  if (isStandalone() || dismissed) return null;
  const ios = isIOS();
  if (!deferred && !ios) return null;

  const install = async () => {
    if (ios) return setIosHelp(true);
    await deferred?.prompt();
    const choice = await deferred?.userChoice;
    if (choice?.outcome === "accepted") deferred = null;
    force((x) => x + 1);
  };
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
  };

  return (
    <div className="bento relative flex flex-wrap items-center gap-3 p-4 pr-9">
      <img src={import.meta.env.BASE_URL + "icons/icon-192.png"} alt="" className="h-12 w-12 rounded-2xl" />
      <div className="min-w-0 flex-1">
        <p className="font-extrabold">Cài Nói Chuẩn lên điện thoại</p>
        <p className="text-sm text-muted-foreground">Mở nhanh từ màn hình chính, dùng cả khi mất mạng.</p>
      </div>
      <Button size="sm" onClick={install} className="w-full min-[460px]:w-auto">
        <Download className="h-4 w-4" /> Cài app
      </Button>
      <button onClick={dismiss} className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground" aria-label="Ẩn gợi ý cài app">
        <X className="h-4 w-4" />
      </button>
      <Dialog open={iosHelp} onOpenChange={setIosHelp}>
        <DialogContent>
          <DialogTitle>Cài trên iPhone / iPad</DialogTitle>
          <DialogDescription>Mở trang này bằng Safari, rồi:</DialogDescription>
          <ol className="mt-4 grid gap-3 text-base">
            <li className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <Share className="h-5 w-5" />
              </span>
              <span>Bấm nút <b>Chia sẻ</b> ở thanh dưới</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <SquarePlus className="h-5 w-5" />
              </span>
              <span>Chọn <b>Thêm vào MH chính</b></span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary text-lg">✓</span>
              <span>Bấm <b>Thêm</b> – biểu tượng Nói Chuẩn sẽ xuất hiện</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}
