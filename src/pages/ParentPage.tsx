// Bảng phụ huynh: % đúng theo tuần, số buổi luyện, từ hay sai, đồng ý camera, xóa dữ liệu.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Camera, Download, Trash2 } from "lucide-react";
import { PageHeader, Ring, pairColorVar, Disclaimer } from "@/components/common";
import { PinGate } from "@/components/PinGate";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { itemById, pairs, textOf } from "@/lib/content";
import { pairAccuracy } from "@/lib/plan";
import { idbClear } from "@/lib/idb";
import { useApp, useChild, useProgress } from "@/store/app";

export default function ParentPage() {
  const parent = useApp((s) => s.parent);
  const [ok, setOk] = useState(false);
  if (!ok) return <PinGate title="Bảng phụ huynh" hint="Nhập mã PIN 4 số của phụ huynh" check={(p) => p === parent?.pin} onOk={() => setOk(true)} />;
  return <Dashboard />;
}

function Dashboard() {
  const nav = useNavigate();
  const child = useChild()!;
  const p = useProgress();
  const parent = useApp((s) => s.parent)!;
  const setParent = useApp((s) => s.setParent);
  const [confirm, setConfirm] = useState<"child" | "all" | null>(null);

  const weeks = useMemo(() => {
    const out: { name: string; pct: number | null; sessions: number; minutes: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const end = Date.now() - w * 7 * 86400000;
      const start = end - 7 * 86400000;
      const ss = p.sessions.filter((s) => s.ts > start && s.ts <= end);
      const c = ss.reduce((a, s) => a + s.correct, 0);
      const t = ss.reduce((a, s) => a + s.total, 0);
      const d = new Date(end);
      out.push({ name: w === 0 ? "Tuần này" : `${d.getDate()}/${d.getMonth() + 1}`, pct: t ? Math.round((100 * c) / t) : null, sessions: ss.length, minutes: Math.round(ss.reduce((a, s) => a + s.durationSec, 0) / 60) });
    }
    return out;
  }, [p.sessions]);
  const thisWeek = weeks[weeks.length - 1];
  const hardWords = useMemo(
    () =>
      Object.entries(p.wordStats)
        .filter(([, s]) => s.a - s.c > 0)
        .sort((a, b) => b[1].a - b[1].c - (a[1].a - a[1].c))
        .slice(0, 8)
        .map(([id, s]) => ({ id, text: itemById(id.split(":")[0]) ? textOf(id.split(":")[0]) : id, wrong: s.a - s.c, total: s.a, heard: s.heard })),
    [p.wordStats],
  );

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ child, progress: p }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `noi-chuan-${child.name}.json`;
    a.click();
  };

  return (
    <div className="grid gap-3">
      <PageHeader title="Bảng phụ huynh" subtitle={child.name} back="/profile" />
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Buổi tuần này" value={thisWeek.sessions} />
        <Kpi label="Phút tuần này" value={thisWeek.minutes} />
        <Kpi label="% đúng tuần này" value={thisWeek.pct === null ? "–" : `${thisWeek.pct}%`} />
      </div>
      <section className="bento p-4">
        <h3 className="font-extrabold">Tỉ lệ đọc đúng theo tuần</h3>
        <div className="mt-3 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                contentStyle={{ borderRadius: 16, border: "none", background: "hsl(var(--card))", boxShadow: "0 8px 24px rgb(0 0 0 / .12)" }}
                formatter={(v: number, _n, item) => [`${v}% · ${(item.payload as { sessions: number }).sessions} buổi`, "Đúng"]}
              />
              <Bar dataKey="pct" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="bento p-4">
        <h3 className="mb-3 font-extrabold">Theo cặp lỗi</h3>
        <div className="grid grid-cols-3 gap-2">
          {pairs.map((pr) => {
            const acc = pairAccuracy(p, pr.id);
            return (
              <div key={pr.id} className="flex flex-col items-center gap-1">
                <Ring value={acc ?? 0} size={64} color={pairColorVar(pr.id)}>
                  {acc === null ? "–" : `${Math.round(acc * 100)}%`}
                </Ring>
                <span className="text-sm font-bold">{pr.label}</span>
                <span className="text-[11px] text-muted-foreground">{p.pairStats[pr.id]?.a ?? 0} lần đọc</span>
              </div>
            );
          })}
        </div>
      </section>
      <section className="bento p-4">
        <h3 className="font-extrabold">Từ con hay đọc sai</h3>
        {hardWords.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Chưa có dữ liệu.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {hardWords.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2">
                <span className="font-bold">{w.text}</span>
                <span className="text-sm text-muted-foreground">
                  {w.heard ? `nghe thành “${w.heard}” · ` : ""}sai {w.wrong}/{w.total}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="bento divide-y">
        <div className="flex items-center justify-between gap-3 p-4">
          <span className="flex items-center gap-2 font-semibold">
            <Camera className="h-5 w-5 text-muted-foreground" /> Cho phép camera (Gương Thần)
          </span>
          <Switch checked={parent.consentCamera} onCheckedChange={(v) => setParent({ ...parent, consentCamera: v })} aria-label="Cho phép camera" />
        </div>
        <button onClick={exportData} className="flex w-full items-center gap-2 p-4 text-left font-semibold">
          <Download className="h-5 w-5 text-muted-foreground" /> Tải dữ liệu của con (JSON)
        </button>
        <button onClick={() => setConfirm("child")} className="flex w-full items-center gap-2 p-4 text-left font-semibold text-destructive">
          <Trash2 className="h-5 w-5" /> Xóa toàn bộ dữ liệu của {child.name}
        </button>
        <button onClick={() => setConfirm("all")} className="flex w-full items-center gap-2 p-4 text-left font-semibold text-destructive">
          <Trash2 className="h-5 w-5" /> Xóa tài khoản và mọi dữ liệu trên máy
        </button>
      </section>
      <p className="px-1 text-xs text-muted-foreground">Ứng dụng không lưu file ghi âm của con – chỉ lưu điểm và thống kê. Đồng ý thu âm lúc: {new Date(parent.consentAt).toLocaleString("vi-VN")}.</p>
      <Disclaimer className="px-1" />
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogTitle>Xóa dữ liệu?</DialogTitle>
          <DialogDescription>{confirm === "child" ? `Toàn bộ điểm, huy hiệu, lịch sử luyện của ${child.name} sẽ bị xóa vĩnh viễn.` : "Tài khoản phụ huynh, mọi hồ sơ con và dữ liệu trên máy này sẽ bị xóa vĩnh viễn."}</DialogDescription>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const st = useApp.getState();
                if (confirm === "child") st.deleteChildData(child.id);
                else {
                  st.deleteAllData();
                  await idbClear().catch(() => {});
                }
                setConfirm(null);
                nav("/");
              }}
            >
              Xóa vĩnh viễn
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bento p-3 text-center">
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}
