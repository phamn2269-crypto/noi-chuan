// Bác Sĩ Ngọng: linh vật đọc sai, con tìm lỗi (âm nào bị đọc nhầm) và đọc lại đúng.
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Stethoscope, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemImage } from "@/components/common";
import { Mascot } from "@/components/Mascot";
import { speak } from "@/lib/audio";
import { phonemes } from "@/lib/content";
import { feedbackFx } from "@/lib/fx";
import { swapOnset } from "@/lib/vietnamese";
import { cn } from "@/lib/utils";
import { useChild } from "@/store/app";
import { gameWords, type GameProps } from "./shared";
import { ReadBlock } from "./ReadBlock";

export default function BacSi({ pairId, difficulty, onFinish }: GameProps) {
  const child = useChild()!;
  const words = useMemo(() => gameWords(pairId, difficulty, 5), [pairId, difficulty]);
  const [i, setI] = useState(0);
  const [diag, setDiag] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [talking, setTalking] = useState(false);
  const w = words[i];
  const wrong = swapOnset(w.text, w.targetSound, w.confusableSound);
  const sayWrong = async () => {
    setTalking(true);
    const pb = await speak(wrong);
    await pb.done;
    setTalking(false);
  };
  const choose = (s: string) => {
    if (diag) return;
    setDiag(s);
    const ok = s === w.targetSound;
    feedbackFx(ok);
    if (ok) setScore((x) => x + 1);
  };
  return (
    <div className="flex flex-1 flex-col">
      <div className="bento flex items-center gap-3 p-4">
        <Mascot kind={child.mascot === "meo" ? "sao" : "meo"} mood={talking ? "talk" : diag ? "happy" : "sad"} size={84} />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Bạn ấy muốn nói “{w.image.emoji}” nhưng lại đọc là:</p>
          <p className="text-4xl font-extrabold text-destructive line-through decoration-2">{wrong}</p>
          <Button variant="ghost" size="sm" className="-ml-2" onClick={sayWrong}>
            <Volume2 className="h-4 w-4" /> Nghe bạn đọc
          </Button>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-2 font-bold">
        <Stethoscope className="h-5 w-5 text-primary" /> Bác sĩ ơi, đúng ra phải là âm nào?
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {[w.targetSound, w.confusableSound].sort().map((s) => (
          <motion.button key={s} whileTap={{ scale: 0.95 }} onClick={() => choose(s)} className={cn("bento py-4 text-3xl font-extrabold ring-4 ring-transparent", diag && s === w.targetSound && "ring-success", diag === s && s !== w.targetSound && "ring-destructive")}>
            {phonemes[s].label}
          </motion.button>
        ))}
      </div>
      {diag && (
        <>
          <div className="bento mt-4 flex items-center justify-center gap-3 p-4">
            <ItemImage image={w.image} className="text-4xl" />
            <p className="text-3xl font-extrabold text-success">{w.text}</p>
          </div>
          <p className="mt-2 text-center text-sm font-semibold">Con đọc lại thật đúng giúp bạn nhé!</p>
          <ReadBlock
            key={w.id}
            text={w.text}
            itemId={w.id}
            pairId={w.pairId}
            sound={w.targetSound}
            onScored={(r) => r.correct && setScore((x) => x + 1)}
            onNext={() => {
              if (i + 1 >= words.length) onFinish({ correct: score, total: words.length * 2, xp: 15 + score * 5 });
              else {
                setI(i + 1);
                setDiag(null);
              }
            }}
          />
        </>
      )}
    </div>
  );
}
