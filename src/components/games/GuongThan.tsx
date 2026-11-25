// Gương Thần 3D: bật camera (tùy chọn, KHÔNG lưu hình) để so khẩu hình với mô hình 3D; chỉ chấm theo giọng nói.
import { useEffect, useMemo, useRef, useState } from "react";
import { CameraOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemImage } from "@/components/common";
import { Mouth3D } from "@/components/Mouth3D";
import { MouthDriver } from "@/components/three/driver";
import { phonemes } from "@/lib/content";
import { useApp } from "@/store/app";
import { playWithMouth } from "@/pages/LessonPage";
import { gameWords, type GameProps } from "./shared";
import { ReadBlock } from "./ReadBlock";

export default function GuongThan({ pairId, difficulty, onFinish }: GameProps) {
  const consentCamera = useApp((s) => s.parent?.consentCamera ?? false);
  const words = useMemo(() => gameWords(pairId, difficulty, 4), [pairId, difficulty]);
  const driver = useMemo(() => new MouthDriver(), []);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [cam, setCam] = useState<"off" | "on" | "denied">("off");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const w = words[i];
  useEffect(() => driver.setPose(w.targetSound), [w, driver]);
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  const startCam = async () => {
    try {
      // chỉ hiển thị trên máy – không ghi, không gửi đi đâu
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480, height: 480 }, audio: false });
      if (video.current) video.current.srcObject = stream.current;
      setCam("on");
    } catch {
      setCam("denied");
    }
  };
  const stopCam = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCam("off");
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="grid grid-cols-2 gap-2">
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-slate-900">
          <video ref={video} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          {cam !== "on" && (
            <div className="absolute inset-0 grid place-items-center p-3 text-center text-sm text-white/80">
              {!consentCamera ? (
                <span>
                  <CameraOff className="mx-auto mb-1 h-6 w-6" />
                  Bố mẹ chưa cho phép camera. Con vẫn chơi được bằng giọng nói!
                </span>
              ) : cam === "denied" ? (
                "Không mở được camera."
              ) : (
                <Button size="sm" onClick={startCam}>
                  Bật gương
                </Button>
              )}
            </div>
          )}
          {cam === "on" && (
            <button onClick={stopCam} className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white" aria-label="Tắt camera">
              <CameraOff className="h-4 w-4" />
            </button>
          )}
          <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">Gương của con · không lưu hình</span>
        </div>
        <Mouth3D driver={driver} focus={w.targetSound} defaultView="front" controls={false} compact className="aspect-square" />
      </div>
      <div className="bento mt-3 flex items-center gap-3 p-4">
        <ItemImage image={w.image} className="text-4xl" />
        <div className="flex-1">
          <p className="text-3xl font-extrabold">{w.text}</p>
          <p className="text-sm text-muted-foreground">{phonemes[w.targetSound].kidHint}</p>
        </div>
        <Button variant="soft" size="icon" onClick={() => playWithMouth(driver, w.id, "slow", w.targetSound)} aria-label="Nghe và xem">
          <Volume2 className="h-5 w-5" />
        </Button>
      </div>
      <ReadBlock
        key={w.id}
        text={w.text}
        itemId={w.id}
        pairId={w.pairId}
        sound={w.targetSound}
        onScored={(r) => r.correct && setScore((x) => x + 1)}
        onNext={() => (i + 1 >= words.length ? (stopCam(), onFinish({ correct: score, total: words.length, xp: 15 + score * 6 })) : setI(i + 1))}
      />
    </div>
  );
}
