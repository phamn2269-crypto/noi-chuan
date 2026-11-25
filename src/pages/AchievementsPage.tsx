import { motion } from "framer-motion";
import { Crown, Flame, Star, Trophy } from "lucide-react";
import { PageHeader } from "@/components/common";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mascot } from "@/components/Mascot";
import { BADGES, OUTFITS, levelOf, useChild, useProgress } from "@/store/app";
import { weekKey } from "@/components/games/NoiNhanh";
import { cn } from "@/lib/utils";

// Bảng xếp hạng chỉ trong lớp, chỉ hiện biệt danh. MVP chưa có máy chủ → bạn cùng lớp là dữ liệu mẫu.
const DEMO_CLASSMATES = [
  { nick: "Cáo Lửa", xp: 1240, speed: 41 },
  { nick: "Mèo Mun", xp: 980, speed: 37 },
  { nick: "Sóc Nâu", xp: 760, speed: 33 },
  { nick: "Gấu Trúc", xp: 540, speed: 29 },
  { nick: "Cá Heo", xp: 310, speed: 22 },
];

export default function AchievementsPage() {
  const child = useChild()!;
  const p = useProgress();
  const lv = levelOf(p.xp);
  const weekXp = p.sessions.filter((s) => Date.now() - s.ts < 7 * 86400000).reduce((a, s) => a + s.xp, 0);
  const mySpeed = p.records[`noi-nhanh-${weekKey()}`] ?? 0;
  const board = [...DEMO_CLASSMATES.map((d) => ({ ...d, me: false })), { nick: child.nickname, xp: weekXp, speed: mySpeed, me: true }].sort((a, b) => b.xp - a.xp);
  const teen = child.mode === "teen";
  return (
    <div>
      <PageHeader title="Thành tích" />
      <div className="bento flex items-center gap-4 p-4">
        <Mascot kind={child.mascot} outfit={p.pet.outfit} size={80} mood="happy" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-muted-foreground">Cấp độ</p>
          <p className="text-3xl font-extrabold">Cấp {lv.level}</p>
          <Progress value={(lv.into / lv.need) * 100} className="mt-2" />
          <p className="mt-1 text-xs text-muted-foreground">
            {lv.into}/{lv.need} XP để lên cấp
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat icon={<Star className="h-5 w-5 fill-amber-400 text-amber-400" />} label="Sao" value={p.stars} />
        <Stat icon={<Flame className="h-5 w-5 text-orange-500" />} label="Chuỗi tốt nhất" value={p.bestStreak} />
        <Stat icon={<Trophy className="h-5 w-5 text-primary" />} label="Tổng XP" value={p.xp} />
      </div>
      <Tabs defaultValue="badges" className="mt-4">
        <TabsList>
          <TabsTrigger value="badges">Huy hiệu</TabsTrigger>
          <TabsTrigger value="outfits">Trang phục</TabsTrigger>
          {teen && <TabsTrigger value="board">Xếp hạng tuần</TabsTrigger>}
        </TabsList>
        <TabsContent value="badges">
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(BADGES).map(([id, b], i) => {
              const own = p.badges.includes(id);
              return (
                <motion.div key={id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }} className={cn("bento flex flex-col items-center p-3 text-center", !own && "opacity-45 grayscale")}>
                  <span className="text-4xl">{b.emoji}</span>
                  <span className="mt-1 text-sm font-bold leading-tight">{b.title}</span>
                  <span className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{b.desc}</span>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="outfits">
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(OUTFITS).map(([k, o]) => {
              const own = p.pet.unlocked.includes(k);
              return (
                <div key={k} className={cn("bento flex flex-col items-center p-3", !own && "opacity-45")}>
                  <span className="text-4xl">{own ? o.emoji : "🔒"}</span>
                  <span className="mt-1 text-sm font-bold">{o.label}</span>
                  <span className="text-[11px] text-muted-foreground">{own ? "Đã mở" : `Cấp ${o.level} hoặc rương quà`}</span>
                </div>
              );
            })}
          </div>
        </TabsContent>
        {teen && (
          <TabsContent value="board">
            <div className="bento divide-y p-2">
              {board.map((r, i) => (
                <div key={r.nick + i} className={cn("flex items-center gap-3 px-3 py-2.5", r.me && "rounded-2xl bg-primary-soft")}>
                  <span className="w-6 text-center font-extrabold">{i === 0 ? <Crown className="mx-auto h-5 w-5 text-amber-500" /> : i + 1}</span>
                  <span className="flex-1 font-semibold">
                    {r.nick} {r.me && <span className="text-xs text-primary">(con)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">⚡ {r.speed}/phút</span>
                  <span className="w-16 text-right font-bold">{r.xp} XP</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Chỉ hiện biệt danh, chỉ trong lớp {child.classCode ?? "(chưa có mã lớp)"}. Bạn cùng lớp đang là dữ liệu mẫu cho tới khi bật đồng bộ máy chủ.</p>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bento flex flex-col items-center p-3 text-center">
      {icon}
      <span className="mt-1 text-2xl font-extrabold">{value}</span>
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}
