// Khi đọc sai: mở mô hình 3D ở tư thế âm đúng và làm nổi bật bộ phận cần chỉnh.
import { useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Mouth3D } from "@/components/Mouth3D";
import { MouthDriver } from "@/components/three/driver";
import { SpeakerButton } from "@/components/SpeakerButton";
import { phonemes } from "@/lib/content";
import { useChild } from "@/store/app";

export function MouthDialog({ open, onOpenChange, sound, wrongSound }: { open: boolean; onOpenChange: (o: boolean) => void; sound: string; wrongSound?: string | null }) {
  const driver = useMemo(() => new MouthDriver(), []);
  const child = useChild();
  useEffect(() => {
    if (open) driver.setPose(sound);
  }, [open, sound, driver]);
  const p = phonemes[sound];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-4">
        <DialogTitle>Khẩu hình âm “{p?.label ?? sound}”</DialogTitle>
        <DialogDescription>{wrongSound ? `Con vừa đọc thành “${phonemes[wrongSound]?.label ?? wrongSound}”. Xem cách đặt lưỡi đúng nhé.` : "Xem cách đặt lưỡi, môi và luồng hơi."}</DialogDescription>
        {open && <Mouth3D driver={driver} focus={sound} className="mt-3 h-72" compact />}
        <div className="mt-3 flex items-start gap-3 rounded-2xl bg-primary-soft p-3">
          <SpeakerButton id={`hint-${sound}`} size="sm" />
          <div>
            <p className="font-semibold">{child?.mode === "teen" ? p?.teenHint : p?.kidHint}</p>
            {p?.tip && <p className="mt-1 text-sm text-muted-foreground">💡 {p.tip}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
