// Truyện Tranh Tương Tác: đọc đúng một câu để lật trang; cuối truyện nhận huy hiệu.
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SpeakerButton } from "@/components/SpeakerButton";
import { storiesOf } from "@/lib/content";
import { shuffle } from "@/lib/utils";
import { useApp } from "@/store/app";
import { activePairs, type GameProps } from "./shared";
import { ReadBlock } from "./ReadBlock";

export default function Truyen({ pairId, onFinish }: GameProps) {
  const story = useMemo(() => shuffle(activePairs(pairId).flatMap((p) => storiesOf(p.id)))[0], [pairId]);
  const [page, setPage] = useState(0);
  const [tries, setTries] = useState(0);
  const [score, setScore] = useState(0);
  const pg = story.pages[page];
  const flip = () => {
    setTries(0);
    if (page + 1 >= story.pages.length) {
      useApp.getState().awardBadge("story-hero");
      onFinish({ correct: score, total: story.pages.length, xp: 20 + score * 8, note: `Hết truyện “${story.title}”!` });
    } else setPage(page + 1);
  };
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-center text-sm font-bold text-muted-foreground">
        {story.cover} {story.title} · Trang {page + 1}/{story.pages.length}
      </p>
      <div className="relative mt-3 [perspective:1200px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ rotateY: 80, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -80, opacity: 0 }}
            transition={{ duration: 0.45 }}
            style={{ transformOrigin: "left center" }}
            className="bento overflow-hidden"
          >
            <div className="grid h-48 place-items-center bg-gradient-to-br from-amber-100 to-rose-100 text-7xl tracking-widest dark:from-amber-900/40 dark:to-rose-900/40">{pg.scene}</div>
            <div className="flex items-center gap-3 p-5">
              <p className="flex-1 text-2xl font-bold leading-snug">{pg.text}</p>
              <SpeakerButton id={`${story.id}-${page + 1}`} text={pg.text} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <ReadBlock
        key={page}
        text={pg.text}
        itemId={`${story.id}-${page + 1}`}
        pairId={story.pairId}
        onScored={(r) => {
          setTries((t) => t + 1);
          if (r.correct) setScore((x) => x + 1);
        }}
        onNext={flip}
        nextLabel={tries >= 2 || page + 1 >= story.pages.length ? "Lật trang" : "Lật trang"}
        micLabel="Đọc để lật trang"
      />
    </div>
  );
}
