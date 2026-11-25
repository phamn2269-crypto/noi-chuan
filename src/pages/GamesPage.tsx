import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Mic } from "lucide-react";
import { PageHeader } from "@/components/common";
import { GAMES } from "@/lib/games";
import { levelOf, useChild, useProgress } from "@/store/app";
import { cn } from "@/lib/utils";

export default function GamesPage() {
  const child = useChild()!;
  const p = useProgress();
  const level = levelOf(p.xp).level;
  const list = GAMES.filter((g) => !g.teenOnly || child.mode === "teen");
  return (
    <div>
      <PageHeader title="Trò chơi" subtitle={`Cấp ${level} · mỗi trò 1–3 phút`} />
      <motion.div className="grid grid-cols-2 gap-3" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.04 } } }}>
        {list.map((g) => {
          const locked = level < g.unlockLevel;
          return (
            <motion.div key={g.id} variants={{ h: { opacity: 0, y: 14 }, s: { opacity: 1, y: 0 } }} whileTap={{ scale: 0.97 }}>
              <Link to={`/play/${g.id}`} className={cn("relative flex h-full flex-col overflow-hidden rounded-3xl bg-card shadow-soft", locked && "opacity-70")}>
                <div className={`grid h-24 place-items-center bg-gradient-to-br ${g.gradient} text-5xl`}>{locked ? <Lock className="h-9 w-9 text-white" /> : g.emoji}</div>
                <div className="flex flex-1 flex-col p-3">
                  <p className="font-extrabold leading-tight">{g.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{g.desc}</p>
                  <div className="mt-auto flex items-center gap-2 pt-2 text-[11px] font-semibold text-muted-foreground">
                    <span>{g.minutes}</span>
                    {g.needsMic && <Mic className="h-3 w-3" />}
                    {locked && <span className="ml-auto rounded-full bg-muted px-2 py-0.5">Cấp {g.unlockLevel}</span>}
                    {!locked && (p.gamesPlayed[g.id] ?? 0) > 0 && <span className="ml-auto">▶ {p.gamesPlayed[g.id]}</span>}
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
