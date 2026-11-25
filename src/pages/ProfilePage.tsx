import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, CircleHelp, GraduationCap, Moon, Plus, ShieldCheck, Sun, SunMoon, Users } from "lucide-react";
import { PageHeader, Disclaimer } from "@/components/common";
import { Switch } from "@/components/ui/switch";
import { Mascot, mascotName } from "@/components/Mascot";
import { InstallCard } from "@/components/InstallCard";
import { OfflineCard } from "@/components/OfflineCard";
import { useApp, useChild, type MascotKind } from "@/store/app";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const nav = useNavigate();
  const child = useChild()!;
  const { settings, setSettings, children, setActiveChild, updateChild } = useApp();
  return (
    <div className="grid gap-3">
      <PageHeader title="Hồ sơ" />
      <div className="bento flex items-center gap-4 p-4">
        <Mascot kind={child.mascot} size={72} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-extrabold">{child.name}</p>
          <p className="text-sm text-muted-foreground">
            Lớp {child.grade} · biệt danh “{child.nickname}”{child.classCode ? ` · ${child.classCode}` : ""}
          </p>
        </div>
      </div>

      <Section title="Học tập">
        <Row label="Giao diện">
          <Seg value={child.mode} options={[["kid", "Nhí"], ["teen", "Teen"]]} onChange={(v) => updateChild(child.id, { mode: v as "kid" | "teen" })} />
        </Row>
        <Row label="Giọng mẫu">
          <Seg value={child.voice} options={[["bac", "Bắc"], ["nam", "Nam"]]} onChange={(v) => updateChild(child.id, { voice: v as "bac" | "nam" })} />
        </Row>
        <Row label="Gương mặt mẫu">
          <Seg value={child.face ?? "f"} options={[["f", "Bạn gái"], ["m", "Bạn trai"]]} onChange={(v) => updateChild(child.id, { face: v as "m" | "f" })} />
        </Row>
        <Row label="Bạn đồng hành">
          <div className="flex gap-1">
            {(["sao", "meo", "rua", "cun"] as MascotKind[]).map((k) => (
              <button key={k} onClick={() => updateChild(child.id, { mascot: k })} className={cn("rounded-2xl p-0.5 ring-2", child.mascot === k ? "ring-primary" : "ring-transparent")} aria-label={mascotName(k)}>
                <Mascot kind={k} size={36} />
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="Hiển thị & âm thanh">
        <Row label="Chủ đề">
          <Seg
            value={settings.theme}
            options={[
              ["light", <Sun key="l" className="h-4 w-4" aria-label="Sáng" />],
              ["system", <SunMoon key="s" className="h-4 w-4" aria-label="Theo máy" />],
              ["dark", <Moon key="d" className="h-4 w-4" aria-label="Tối" />],
            ]}
            onChange={(v) => setSettings({ theme: v as never })}
          />
        </Row>
        <Row label="Âm thanh đúng/sai">
          <Switch checked={settings.sound} onCheckedChange={(v) => setSettings({ sound: v })} aria-label="Âm thanh" />
        </Row>
        <Row label="Rung nhẹ">
          <Switch checked={settings.haptics} onCheckedChange={(v) => setSettings({ haptics: v })} aria-label="Rung" />
        </Row>
        <Row label="Giảm chuyển động">
          <Seg value={settings.reducedMotion} options={[["system", "Theo máy"], ["on", "Bật"], ["off", "Tắt"]]} onChange={(v) => setSettings({ reducedMotion: v as never })} />
        </Row>
        <Row label="Khẩu hình">
          <Seg value={settings.headStyle ?? "real"} options={[["real", "Mặt thật"], ["diagram", "Sơ đồ"]]} onChange={(v) => setSettings({ headStyle: v as never })} />
        </Row>
        <Row label="Đồ họa">
          <Seg value={settings.render3d} options={[["auto", "Tự động"], ["3d", "3D"], ["image", "Ảnh"]]} onChange={(v) => setSettings({ render3d: v as never })} />
        </Row>
      </Section>

      <Section title="Tài khoản">
        {children.length > 1 &&
          children
            .filter((c) => c.id !== child.id)
            .map((c) => (
              <button key={c.id} onClick={() => setActiveChild(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <Users className="h-5 w-5 text-muted-foreground" /> <span className="flex-1 font-semibold">Chuyển sang {c.name}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ))}
        <button onClick={() => nav("/welcome")} className="flex w-full items-center gap-3 px-4 py-3 text-left">
          <Plus className="h-5 w-5 text-muted-foreground" /> <span className="flex-1 font-semibold">Thêm hồ sơ con</span>
          <ChevronRight className="h-4 w-4" />
        </button>
        <Link to="/parent" className="flex items-center gap-3 px-4 py-3">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" /> <span className="flex-1 font-semibold">Bảng phụ huynh</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
        <Link to="/help" className="flex items-center gap-3 px-4 py-3">
          <CircleHelp className="h-5 w-5 text-muted-foreground" /> <span className="flex-1 font-semibold">Hướng dẫn & quyền riêng tư</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
        <Link to="/admin" className="flex items-center gap-3 px-4 py-3">
          <GraduationCap className="h-5 w-5 text-muted-foreground" /> <span className="flex-1 font-semibold">Trang giáo viên / quản trị</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Section>
      <InstallCard />
      <OfflineCard />
      <Disclaimer className="px-1" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-sm font-bold text-muted-foreground">{title}</h2>
      <div className="bento divide-y">{children}</div>
    </section>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-2">
      <span className="font-semibold">{label}</span>
      {children}
    </div>
  );
}
function Seg({ value, options, onChange }: { value: string; options: [string, React.ReactNode][]; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-xl bg-muted p-0.5">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v} aria-label={typeof l === "string" ? undefined : ({ light: "Chủ đề sáng", system: "Chủ đề theo máy", dark: "Chủ đề tối" } as Record<string, string>)[v]} className={cn("min-w-[2.5rem] rounded-lg px-2.5 py-1.5 text-xs font-bold", value === v ? "bg-card shadow-soft" : "text-muted-foreground")}>
          {l}
        </button>
      ))}
    </div>
  );
}
