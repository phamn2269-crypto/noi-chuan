// Phòng khẩu hình 3D: chọn âm bất kỳ để xem, so sánh 2 âm cạnh nhau.
import { useEffect, useMemo, useState } from "react";
import { Columns2, Snail, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common";
import { Mouth3D } from "@/components/Mouth3D";
import { MouthDriver } from "@/components/three/driver";
import { SpeakerButton } from "@/components/SpeakerButton";
import { phonemes, pairs, wordsOf } from "@/lib/content";
import { playItem, speak, stopAll } from "@/lib/audio";
import { poseTrack, estimateTimings } from "@/lib/vietnamese";
import { cn } from "@/lib/utils";
import { useChild } from "@/store/app";

const ORDER = ["n", "l", "ch", "tr", "s", "x", "t", "r", "m", "v", "a", "o", "u", "i", "rest"];

/** Âm tiết mẫu để nghe âm đứng đầu: n → "na". */
const sampleSyllable = (s: string) => (["a", "o", "u", "i"].includes(s) ? s : s === "rest" ? "" : `${s}a`);

export default function MouthRoomPage() {
  const child = useChild()!;
  const [a, setA] = useState("n");
  const [b, setB] = useState("l");
  const [compare, setCompare] = useState(false);
  const [picking, setPicking] = useState<"a" | "b">("a");
  const da = useMemo(() => new MouthDriver(), []);
  const db = useMemo(() => new MouthDriver(), []);
  useEffect(() => da.setPose(a), [a, da]);
  useEffect(() => db.setPose(b), [b, db]);
  useEffect(() => () => stopAll(), []);

  const demo = async (driver: MouthDriver, s: string, slow: boolean) => {
    const word = wordsOf().find((w) => w.targetSound === s);
    const text = word?.text ?? sampleSyllable(s);
    if (!text) return;
    // có giọng mẫu (đã duyệt) → phát file thật với mốc thời gian thật; không thì đọc bằng Web Speech
    const pb = word ? await playItem(word.id, { speed: slow ? "half" : "slow" }) : await speak(text, slow ? "half" : "slow");
    // mốc ước lượng nếu đọc bằng Web Speech
    const track = pb.track.length > 1 ? pb.track : poseTrack(estimateTimings(text));
    driver.play(track, pb.clock, slow);
    await pb.done;
    driver.stop(s);
  };

  const pick = (s: string) => (compare && picking === "b" ? setB(s) : setA(s));
  const Info = ({ s }: { s: string }) => (
    <div className="flex items-start gap-2 rounded-2xl bg-card p-3 shadow-soft">
      <SpeakerButton id={`hint-${s}`} size="sm" />
      <p className="text-sm font-medium leading-snug">{child.mode === "teen" ? phonemes[s]?.teenHint : phonemes[s]?.kidHint}</p>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Khẩu hình 3D"
        subtitle="Xoay, phóng to bằng ngón tay"
        right={
          <Button variant={compare ? "default" : "outline"} size="sm" onClick={() => setCompare((c) => !c)}>
            <Columns2 className="h-4 w-4" /> So sánh
          </Button>
        }
      />
      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {ORDER.map((s) => {
          const pair = pairs.find((p) => p.sounds.includes(s));
          const active = s === a || (compare && s === b);
          return (
            <button key={s} onClick={() => pick(s)} className={cn("h-11 min-w-[3rem] shrink-0 rounded-2xl px-3 text-lg font-extrabold shadow-soft", active ? "bg-primary text-primary-foreground" : pair ? `bg-${pair.color}-soft text-${pair.color}-ink` : "bg-card")}>
              {phonemes[s].label}
            </button>
          );
        })}
      </div>
      {compare && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(["a", "b"] as const).map((k) => (
            <button key={k} onClick={() => setPicking(k)} className={cn("rounded-2xl py-2 text-sm font-bold ring-2", picking === k ? "bg-primary-soft text-primary ring-primary" : "bg-card ring-transparent")}>
              Chọn âm {k === "a" ? "trái" : "phải"}: <b>{phonemes[k === "a" ? a : b].label}</b>
            </button>
          ))}
        </div>
      )}
      {compare ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            [da, a],
            [db, b],
          ].map(([d, s]) => (
            <div key={s as string} className="flex flex-col gap-2">
              <Mouth3D driver={d as MouthDriver} focus={s as string} title={`âm ${phonemes[s as string].label}`} compact className="h-[46dvh] min-h-[260px]" />
              <Button variant="secondary" size="sm" onClick={() => demo(d as MouthDriver, s as string, false)}>
                <Volume2 className="h-4 w-4" /> Nghe
              </Button>
              <Info s={s as string} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <Mouth3D driver={da} focus={a} title={`âm ${phonemes[a].label}`} className="h-[52dvh] min-h-[320px]" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button variant="secondary" onClick={() => demo(da, a, false)}>
              <Volume2 className="h-5 w-5" /> Nghe
            </Button>
            <Button variant="outline" onClick={() => demo(da, a, true)}>
              <Snail className="h-5 w-5" /> Chậm 0,5
            </Button>
            <Button variant="ghost" onClick={() => (stopAll(), da.stop(a))}>
              <Square className="h-4 w-4" /> Dừng
            </Button>
          </div>
          <div className="mt-3">
            <Info s={a} />
          </div>
          {phonemes[a]?.tip && <p className="mt-2 px-1 text-sm text-muted-foreground">💡 {phonemes[a].tip}</p>}
        </>
      )}
    </div>
  );
}
