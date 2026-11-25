import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Flame, Gift, Play, Sparkles, Star, ClipboardList } from "lucide-react";
import { useState } from "react";
import { Mascot } from "@/components/Mascot";
import { InstallCard } from "@/components/InstallCard";
import { Ring, pairColorVar } from "@/components/common";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { pairById, pairs } from "@/lib/content";
import { pairAccuracy, recommendedPair, suggestedGame } from "@/lib/plan";
import { levelOf, useApp, useChild, useProgress } from "@/store/app";
import { todayKey } from "@/lib/utils";
import { celebrate } from "@/lib/fx";

const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function HomePage() {
  const child = useChild()!;
  const p = useProgress();
  const admin = useApp((s) => s.admin);
  const openChest = useApp((s) => s.openChest);
  const lv = levelOf(p.xp);
  const assignment = admin.assignments.find((a) => admin.classes.find((c) => c.id === a.classId)?.code === child.classCode);
  const todayPair = pairById(recommendedPair(p, assignment?.pairId))!;
  const game = suggestedGame(lv.level, child.mode);
  const today = todayKey();
  const minutesToday = Math.round(p.sessions.filter((s) => s.date === today).reduce((a, s) => a + s.durationSec, 0) / 60);
  const chestReady = p.chestDay !== today && p.sessions.some((s) => s.date === today);
  const [chest, setChest] = useState<{ reward: string; emoji: string } | null>(null);
  const kid = child.mode === "kid";
  const hour = new Date().getHours();
  const greet = hour < 11 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  return (
    <motion.div variants={{ show: { transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show" className="grid gap-3">
      <motion.header variants={item} className="flex items-center gap-3">
        <Mascot kind={child.mascot} outfit={p.pet.outfit} size={64} mood="idle" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{greet},</p>
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{child.name} 👋</h1>
        </div>
        <Link to="/achievements" className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-bold shadow-soft">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {p.stars}
        </Link>
      </motion.header>

      {/* Bài hôm nay */}
      <motion.div variants={item}>
        <Link to={`/lesson/${todayPair.id}`} className="bg-hero relative block overflow-hidden rounded-[2rem] p-5 text-white shadow-lift">
          <div className="absolute -right-6 -top-8 text-[120px] leading-none opacity-20">{todayPair.emoji}</div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white/85">
            {assignment ? <ClipboardList className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} {assignment ? "Thầy cô giao" : "Bài hôm nay"} · 4 bước · ~6 phút
          </p>
          <h2 className="mt-1 text-3xl font-extrabold">{todayPair.title}</h2>
          <p className="mt-1 max-w-[16rem] text-sm text-white/85">{kid ? "Nghe – xem khẩu hình – chọn đúng – đọc to" : todayPair.description}</p>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-bold text-[#4535d6] shadow-md">
            <Play className="h-4 w-4 fill-current" /> Bắt đầu
          </span>
        </Link>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        {/* Chuỗi ngày */}
        <motion.div variants={item} className="bento p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Flame className="h-4 w-4 text-orange-500" /> Chuỗi ngày
          </div>
          <p className="mt-1 text-3xl font-extrabold">
            {p.streak} <span className="text-base font-bold text-muted-foreground">ngày</span>
          </p>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: 7 }, (_, k) => {
              const d = new Date();
              d.setDate(d.getDate() - (6 - k));
              const done = p.sessions.some((s) => s.date === todayKey(d));
              return <span key={k} className={`h-2 flex-1 rounded-full ${done ? "bg-orange-400" : "bg-muted"}`} />;
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Hôm nay: {minutesToday} phút</p>
        </motion.div>
        {/* Cấp độ + rương */}
        <motion.div variants={item} className="bento flex flex-col p-4">
          <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
            <span>Cấp {lv.level}</span>
            <span>
              {lv.into}/{lv.need} XP
            </span>
          </div>
          <Progress value={(lv.into / lv.need) * 100} className="mt-2" />
          <motion.button
            whileTap={{ scale: 0.95 }}
            disabled={!chestReady}
            onClick={() => {
              const r = openChest();
              if (r) {
                setChest(r);
                celebrate();
              }
            }}
            className={`mt-3 flex flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold ${chestReady ? "animate-float-y bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200" : "bg-muted text-muted-foreground"}`}
          >
            <Gift className="h-5 w-5" /> {p.chestDay === today ? "Đã mở rương" : chestReady ? "Mở rương quà!" : "Luyện để mở rương"}
          </motion.button>
        </motion.div>
      </div>

      {/* Trò chơi gợi ý */}
      <motion.div variants={item}>
        <Link to={`/play/${game.id}`} className={`flex items-center gap-4 rounded-3xl bg-gradient-to-br ${game.gradient} p-4 text-white shadow-soft`}>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20 text-3xl">{game.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Trò chơi gợi ý</p>
            <p className="text-lg font-extrabold">{game.title}</p>
            <p className="truncate text-sm text-white/85">{game.desc}</p>
          </div>
          <ChevronRight className="h-6 w-6" />
        </Link>
      </motion.div>

      <InstallCard />

      {/* Tiến độ từng cặp lỗi */}
      <motion.div variants={item} className="bento p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-extrabold">Tiến độ từng cặp</h3>
          <Link to="/placement" className="text-sm font-semibold text-primary">
            Kiểm tra lại
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {pairs.map((pr) => {
            const acc = pairAccuracy(p, pr.id);
            return (
              <Link key={pr.id} to={`/lesson/${pr.id}`} className={`bg-grad-${pr.color} flex flex-col items-center gap-1 rounded-2xl p-3`}>
                <Ring value={acc ?? 0} size={58} color={pairColorVar(pr.id)}>
                  {acc === null ? "–" : `${Math.round(acc * 100)}%`}
                </Ring>
                <span className={`text-sm font-extrabold text-${pr.color}-ink`}>{pr.label}</span>
              </Link>
            );
          })}
        </div>
      </motion.div>

      <Dialog open={!!chest} onOpenChange={(o) => !o && setChest(null)}>
        <DialogContent className="text-center">
          <DialogTitle>Rương quà hôm nay</DialogTitle>
          <DialogDescription>Con chăm chỉ quá!</DialogDescription>
          <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring" }} className="my-4 text-7xl">
            {chest?.emoji}
          </motion.div>
          <p className="text-xl font-extrabold">{chest?.reward}</p>
          <Button className="mt-4 w-full" onClick={() => setChest(null)}>
            Tuyệt quá!
          </Button>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
