// Phân Loại Từ: kéo thả từ vào giỏ theo âm đầu, rồi đọc to cả giỏ.
import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ItemImage } from "@/components/common";
import { phonemes } from "@/lib/content";
import { feedbackFx } from "@/lib/fx";
import { playItem } from "@/lib/audio";
import { cn } from "@/lib/utils";
import type { WordItem } from "@/lib/types";
import { activePairs, gameWords, type GameProps } from "./shared";
import { ReadBlock } from "./ReadBlock";

export default function PhanLoai({ pairId, difficulty, onFinish }: GameProps) {
  const pair = useMemo(() => activePairs(pairId)[Math.floor(Math.random() * activePairs(pairId).length)], [pairId]);
  const words = useMemo(() => gameWords(pair.id, difficulty, 6), [pair.id, difficulty]);
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [wrongShake, setWrongShake] = useState<string | null>(null);
  const [phase, setPhase] = useState<"sort" | "read">("sort");
  const [basketIdx, setBasketIdx] = useState(0);
  const [sortCorrect, setSortCorrect] = useState(0);
  const [readCorrect, setReadCorrect] = useState(0);
  const baskets = useRef<Record<string, HTMLDivElement | null>>({});
  const remaining = words.filter((w) => !placed[w.id]);

  const drop = (w: WordItem, x: number, y: number) => {
    for (const s of pair.sounds) {
      const r = baskets.current[s]?.getBoundingClientRect();
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const ok = w.targetSound === s;
        feedbackFx(ok);
        if (ok) {
          setPlaced((p) => ({ ...p, [w.id]: s }));
          setSortCorrect((c) => c + 1);
        } else {
          setWrongShake(w.id);
          setTimeout(() => setWrongShake(null), 500);
        }
        return;
      }
    }
  };
  const tapPlace = (w: WordItem, s: string) => drop(w, ...center(baskets.current[s]));

  if (phase === "read") {
    const s = pair.sounds[basketIdx];
    const list = words.filter((w) => w.targetSound === s);
    const text = list.map((w) => w.text).join(", ");
    return (
      <div className="flex flex-1 flex-col">
        <p className="text-center font-bold">Đọc to cả giỏ “{phonemes[s].label}”</p>
        <div className={`bento bg-grad-${pair.color} mt-3 flex flex-wrap justify-center gap-2 p-5`}>
          {list.map((w) => (
            <span key={w.id} className="rounded-2xl bg-card px-3 py-2 text-2xl font-extrabold shadow-soft">
              {w.image.emoji} {w.text}
            </span>
          ))}
        </div>
        <ReadBlock
          key={s}
          text={text}
          itemId={`basket-${pair.id}-${s}`}
          pairId={pair.id}
          sound={s}
          onScored={(r) => r.correct && setReadCorrect((c) => c + 1)}
          onNext={() => (basketIdx + 1 < pair.sounds.length ? setBasketIdx(basketIdx + 1) : onFinish({ correct: sortCorrect + readCorrect, total: words.length + 2, xp: 15 + sortCorrect * 3 + readCorrect * 10 }))}
          nextLabel={basketIdx + 1 < pair.sounds.length ? "Giỏ tiếp theo" : "Hoàn thành"}
          micLabel="Đọc cả giỏ"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-center text-sm font-semibold text-muted-foreground">Kéo thẻ vào giỏ đúng (hoặc chạm thẻ rồi chọn giỏ). Chạm 🔊 để nghe.</p>
      <div className="mt-3 flex min-h-[150px] flex-wrap content-start justify-center gap-2">
        {remaining.map((w) => (
          <motion.div
            key={w.id}
            drag
            dragSnapToOrigin
            whileDrag={{ scale: 1.1, zIndex: 50 }}
            animate={wrongShake === w.id ? { x: [0, -10, 10, -6, 0] } : {}}
            onDragEnd={(_, info) => drop(w, info.point.x - window.scrollX, info.point.y - window.scrollY)}
            className="flex cursor-grab touch-none select-none items-center gap-1 rounded-2xl bg-card px-3 py-2 shadow-lift active:cursor-grabbing"
          >
            <ItemImage image={w.image} className="text-2xl" />
            <span className="text-xl font-extrabold">{w.text}</span>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={() => playItem(w.id)} className="ml-1 text-sm" aria-label={`Nghe ${w.text}`}>
              🔊
            </button>
            <span className="ml-1 flex gap-1">
              {pair.sounds.map((s) => (
                <button key={s} onPointerDown={(e) => e.stopPropagation()} onClick={() => tapPlace(w, s)} className="rounded-lg bg-muted px-1.5 text-xs font-bold" aria-label={`Bỏ vào giỏ ${s}`}>
                  {s}
                </button>
              ))}
            </span>
          </motion.div>
        ))}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
        {pair.sounds.map((s) => (
          <div key={s} ref={(el) => void (baskets.current[s] = el)} className={cn(`bg-grad-${pair.color} flex min-h-[170px] flex-col items-center rounded-3xl border-4 border-dashed p-3`, `border-${pair.color}`)}>
            <span className="text-4xl">🧺</span>
            <span className={`text-2xl font-extrabold text-${pair.color}-ink`}>âm {phonemes[s].label}</span>
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {words
                .filter((w) => placed[w.id] === s)
                .map((w) => (
                  <motion.span key={w.id} initial={{ scale: 0 }} animate={{ scale: 1 }} className="rounded-xl bg-card px-2 py-0.5 text-sm font-bold">
                    {w.text}
                  </motion.span>
                ))}
            </div>
          </div>
        ))}
      </div>
      <Button size="lg" className="mt-4 w-full" disabled={remaining.length > 0} onClick={() => setPhase("read")}>
        Đọc to cả giỏ
      </Button>
    </div>
  );
}
function center(el?: HTMLDivElement | null): [number, number] {
  const r = el?.getBoundingClientRect();
  return r ? [r.left + r.width / 2, r.top + r.height / 2] : [0, 0];
}
