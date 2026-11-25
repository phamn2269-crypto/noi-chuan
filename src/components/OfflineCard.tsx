import { useState } from "react";
import { CloudDownload, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { prefetchForOffline } from "@/lib/offline";
import { useApp, useChild } from "@/store/app";

/** Tải sẵn giọng mẫu + gương mặt 3D của con để dùng khi mất mạng. */
export function OfflineCard() {
  const child = useChild();
  const headStyle = useApp((s) => s.settings.headStyle ?? "real");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [prog, setProg] = useState({ done: 0, total: 0 });
  if (!child) return null;
  const head = headStyle === "real" ? `${child.mode === "teen" ? "teen" : "child"}_${child.face ?? "f"}` : null;
  const run = async () => {
    setState("busy");
    await prefetchForOffline(child.voice, head, (done, total) => setProg({ done, total }));
    setState("done");
  };
  return (
    <div className="bento p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">{state === "done" ? <Check className="h-5 w-5" /> : <CloudDownload className="h-5 w-5" />}</span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">Tải sẵn để dùng khi mất mạng</p>
          <p className="text-sm text-muted-foreground">Giọng mẫu {child.voice === "nam" ? "miền Nam" : "miền Bắc"} và gương mặt 3D (khoảng 8 MB).</p>
        </div>
      </div>
      {state === "busy" && <Progress className="mt-3" value={prog.total ? (100 * prog.done) / prog.total : 0} label="Đang tải" />}
      <Button className="mt-3 w-full" variant={state === "done" ? "secondary" : "default"} disabled={state === "busy"} onClick={run}>
        {state === "busy" ? `Đang tải ${prog.done}/${prog.total}` : state === "done" ? "Đã tải xong – tải lại" : "Tải về máy"}
      </Button>
    </div>
  );
}
