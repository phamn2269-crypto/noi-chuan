// Trang giáo viên / quản trị: duyệt giọng mẫu, duyệt nội dung, giao bài theo lớp.
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Download, EyeOff, Eye, Play, Plus, Trash2, Upload, X } from "lucide-react";
import { PageHeader } from "@/components/common";
import { PinGate } from "@/components/PinGate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { allAudioIds, lessons, pairs } from "@/lib/content";
import { loadManifest, playItem, reviewStatusOf } from "@/lib/audio";
import { idbDel, idbGet, idbSet } from "@/lib/idb";
import type { AudioManifest, ReviewStatus } from "@/lib/types";
import { useApp } from "@/store/app";
import { asset, cn } from "@/lib/utils";

const ADMIN_CODE = (import.meta.env.VITE_ADMIN_CODE as string | undefined) ?? "giaovien";

export default function AdminPage() {
  const [ok, setOk] = useState(false);
  if (!ok)
    return (
      <div className="mx-auto max-w-3xl px-4 py-4">
        <PageHeader title="Quản trị" back />
        <PinGate title="Trang giáo viên" hint={`Nhập mã quản trị (mặc định bản MVP: “${ADMIN_CODE}”, đổi bằng VITE_ADMIN_CODE)`} check={(p) => p === ADMIN_CODE} onOk={() => setOk(true)} />
      </div>
    );
  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <PageHeader title="Quản trị" subtitle="Giọng mẫu · Nội dung · Lớp học" back />
      <Tabs defaultValue="voice">
        <TabsList>
          <TabsTrigger value="voice">Giọng mẫu</TabsTrigger>
          <TabsTrigger value="content">Nội dung</TabsTrigger>
          <TabsTrigger value="class">Giao bài</TabsTrigger>
        </TabsList>
        <TabsContent value="voice">
          <VoiceReview />
        </TabsContent>
        <TabsContent value="content">
          <ContentReview />
        </TabsContent>
        <TabsContent value="class">
          <Classes />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const STATUS_LABEL: Record<ReviewStatus, string> = { chua_duyet: "Chưa duyệt", da_duyet: "Đạt", doc_sai: "Đọc sai" };

function VoiceReview() {
  const [voice, setVoice] = useState<"bac" | "nam">("bac");
  const [filter, setFilter] = useState<"all" | ReviewStatus | "missing">("all");
  const [manifest, setManifest] = useState<AudioManifest | null>(null);
  const reviews = useApp((s) => s.admin.reviews);
  const missing = useApp((s) => s.admin.missingAudio);
  const setReview = useApp((s) => s.setReview);
  const ids = useMemo(() => allAudioIds(), []);
  useEffect(() => {
    loadManifest().then(setManifest);
  }, []);
  const rows = ids.map((x) => {
    const key = `${voice}/${x.id}`;
    const entry = manifest?.entries[key];
    const r = reviews[key];
    return { ...x, key, entry, status: reviewStatusOf(key, entry) as ReviewStatus, human: !!r?.human, note: r?.note ?? entry?.note ?? "" };
  });
  const shown = rows.filter((r) => (filter === "all" ? true : filter === "missing" ? !r.entry && !r.human : r.status === filter));
  const counts = {
    total: rows.length,
    file: rows.filter((r) => r.entry || r.human).length,
    ok: rows.filter((r) => r.status === "da_duyet").length,
    bad: rows.filter((r) => r.status === "doc_sai").length,
  };
  const exportReviews = () => {
    // Xuất trạng thái duyệt để gộp vào public/audio/manifest.json (hoặc đồng bộ Supabase)
    const out = Object.fromEntries(Object.entries(reviews).map(([k, v]) => [k, { status: v.status, note: v.note, human: v.human }]));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
    a.download = "audio-reviews.json";
    a.click();
  };
  const fallbackIds = Object.entries(missing).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ["Mục", counts.total],
          ["Có file", counts.file],
          ["Đạt", counts.ok],
          ["Đọc sai", counts.bad],
        ].map(([l, v]) => (
          <div key={l} className="bento p-3">
            <p className="text-xl font-extrabold">{v}</p>
            <p className="text-[11px] font-semibold text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      {fallbackIds.length > 0 && (
        <div className="flex gap-2 rounded-3xl bg-warning-soft p-4 text-sm text-warning-foreground dark:text-warning">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">{fallbackIds.length} mục đang phải dùng giọng Web Speech (thiếu file hoặc chưa duyệt)</p>
            <p className="mt-1 opacity-80">{fallbackIds.slice(0, 12).map(([id, n]) => `${id} (${n})`).join(", ")}</p>
          </div>
        </div>
      )}
      {counts.file === 0 && (
        <p className="rounded-3xl bg-muted p-4 text-sm">
          Chưa có file giọng mẫu. Chạy <code className="rounded bg-card px-1">python scripts/generate_audio.py</code> (xem README) rồi tải lại trang. Trong lúc đó app dùng Web Speech API (vi-VN, tốc độ 0,75).
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-muted p-0.5">
          {(["bac", "nam"] as const).map((v) => (
            <button key={v} onClick={() => setVoice(v)} className={cn("rounded-lg px-3 py-1.5 text-sm font-bold", voice === v ? "bg-card shadow-soft" : "text-muted-foreground")}>
              {v === "bac" ? "Nữ Bắc" : "Nữ Nam"}
            </button>
          ))}
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as never)} className="h-9 rounded-xl border bg-card px-2 text-sm font-semibold">
          <option value="all">Tất cả</option>
          <option value="chua_duyet">Chưa duyệt</option>
          <option value="da_duyet">Đạt</option>
          <option value="doc_sai">Đọc sai</option>
          <option value="missing">Thiếu file</option>
        </select>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportReviews}>
          <Download className="h-4 w-4" /> Xuất trạng thái duyệt
        </Button>
      </div>
      <div className="bento divide-y">
        {shown.slice(0, 120).map((r) => (
          <AudioRow key={r.key} row={r} onReview={(patch) => setReview(r.key, patch)} />
        ))}
        {shown.length > 120 && <p className="p-3 text-center text-sm text-muted-foreground">… và {shown.length - 120} mục khác (lọc để xem)</p>}
      </div>
    </div>
  );
}

function AudioRow({ row, onReview }: { row: { id: string; key: string; text: string; status: ReviewStatus; human: boolean; note: string; entry?: unknown }; onReview: (p: { status?: ReviewStatus; note?: string; human?: boolean }) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState(row.note);
  const preview = async (speed: "slow" | "normal") => {
    // nghe đúng file (kể cả chưa duyệt) để duyệt
    if (row.human) {
      const b = await idbGet(`human/${row.key}`);
      if (b) return new Audio(URL.createObjectURL(b)).play();
    }
    const e = row.entry as { slow: string; normal: string } | undefined;
    if (e) return new Audio(asset(speed === "normal" ? e.normal : e.slow)).play();
    playItem(row.id);
  };
  return (
    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{row.text}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <code>{row.id}</code>
          <Badge variant={row.status === "da_duyet" ? "success" : row.status === "doc_sai" ? "warning" : "muted"}>{STATUS_LABEL[row.status]}</Badge>
          {row.human && <Badge>Người thật</Badge>}
          {!row.entry && !row.human && <Badge variant="muted">Thiếu file</Badge>}
        </p>
        <input value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== row.note && onReview({ note })} placeholder="Ghi chú…" className="mt-1 h-8 w-full rounded-lg border bg-background px-2 text-sm" />
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="icon-sm" variant="soft" onClick={() => preview("slow")} aria-label="Nghe bản 0,75">
          <Play className="h-4 w-4" />
        </Button>
        <Button size="icon-sm" variant={row.status === "da_duyet" ? "success" : "outline"} onClick={() => onReview({ status: "da_duyet" })} aria-label="Đạt">
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon-sm" variant={row.status === "doc_sai" ? "destructive" : "outline"} onClick={() => onReview({ status: "doc_sai" })} aria-label="Đọc sai">
          <X className="h-4 w-4" />
        </Button>
        <Button size="icon-sm" variant="outline" onClick={() => file.current?.click()} aria-label="Tải lên ghi âm người thật">
          <Upload className="h-4 w-4" />
        </Button>
        {row.human && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={async () => {
              await idbDel(`human/${row.key}`);
              onReview({ human: false });
            }}
            aria-label="Bỏ ghi âm người thật"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <input
          ref={file}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            await idbSet(`human/${row.key}`, f);
            onReview({ human: true, status: "da_duyet" });
          }}
        />
      </div>
    </div>
  );
}

function ContentReview() {
  const hidden = useApp((s) => s.admin.hiddenItems);
  const toggle = useApp((s) => s.toggleHiddenItem);
  const [pairId, setPairId] = useState(pairs[0].id);
  const [type, setType] = useState("word");
  const items = lessons.items.filter((i) => i.pairId === pairId && i.type === type);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {pairs.map((p) => (
          <button key={p.id} onClick={() => setPairId(p.id)} className={cn("rounded-xl px-3 py-1.5 text-sm font-bold", pairId === p.id ? `bg-${p.color}-soft text-${p.color}-ink` : "bg-card shadow-soft")}>
            {p.label}
          </button>
        ))}
        <select value={type} onChange={(e) => setType(e.target.value)} className="ml-auto h-9 rounded-xl border bg-card px-2 text-sm font-semibold">
          <option value="word">Từ</option>
          <option value="minimal_pair">Cặp từ</option>
          <option value="sentence">Câu</option>
          <option value="verse">Vè / câu đố</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground">Ẩn mục chưa phù hợp – mục bị ẩn sẽ không xuất hiện trong bài luyện và trò chơi. Thêm nội dung mới: sửa data/lessons.json (xem README).</p>
      <div className="bento divide-y">
        {items.map((it) => {
          const off = hidden.includes(it.id);
          const text = it.type === "minimal_pair" ? it.options.map((o) => `${o.image.emoji} ${o.text}`).join("  /  ") : it.type === "word" ? `${it.image.emoji} ${it.text}` : it.text;
          return (
            <div key={it.id} className={cn("flex items-center gap-3 p-3", off && "opacity-50")}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{text}</p>
                <p className="text-xs text-muted-foreground">
                  {it.id} · độ khó {it.difficulty}
                  {it.type === "word" && ` · âm mục tiêu ${it.targetSound} · khẩu hình ${it.mouthShape}`}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => toggle(it.id)}>
                {off ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} {off ? "Hiện" : "Ẩn"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Classes() {
  const { classes, assignments } = useApp((s) => s.admin);
  const { addClass, addAssignment, removeAssignment } = useApp();
  const [name, setName] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [pairId, setPairId] = useState(pairs[0].id);
  const [due, setDue] = useState("");
  return (
    <div className="grid gap-3">
      <section className="bento p-4">
        <h3 className="font-extrabold">Lớp học</h3>
        <ul className="mt-2 divide-y">
          {classes.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span className="font-semibold">{c.name}</span>
              <code className="rounded-lg bg-muted px-2 py-0.5 text-sm">{c.code}</code>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) addClass(name.trim());
            setName("");
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên lớp, vd: 2B" className="h-10 flex-1 rounded-xl border bg-background px-3" />
          <Button size="sm" type="submit">
            <Plus className="h-4 w-4" /> Thêm lớp
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">Phụ huynh nhập mã lớp trong hồ sơ của con để nhận bài được giao.</p>
      </section>
      <section className="bento p-4">
        <h3 className="font-extrabold">Giao bài</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="h-10 rounded-xl border bg-background px-2">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={pairId} onChange={(e) => setPairId(e.target.value)} className="h-10 rounded-xl border bg-background px-2">
            {pairs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-10 rounded-xl border bg-background px-2" />
          <Button onClick={() => classId && addAssignment({ classId, pairId, title: `Luyện ${pairs.find((p) => p.id === pairId)?.label}`, due: due || undefined })}>Giao bài</Button>
        </div>
        <ul className="mt-3 divide-y">
          {assignments.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-2">
              <span className="flex-1 font-semibold">
                {a.title} · {classes.find((c) => c.id === a.classId)?.name}
              </span>
              {a.due && <span className="text-sm text-muted-foreground">hạn {a.due}</span>}
              <Button size="icon-sm" variant="ghost" onClick={() => removeAssignment(a.id)} aria-label="Xóa">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
          {!assignments.length && <li className="py-2 text-sm text-muted-foreground">Chưa có bài nào.</li>}
        </ul>
      </section>
    </div>
  );
}
