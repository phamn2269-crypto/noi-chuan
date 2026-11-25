import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Camera, Check, Lock, Mic, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mascot, mascotName } from "@/components/Mascot";
import { Disclaimer } from "@/components/common";
import { SpeakerButton } from "@/components/SpeakerButton";
import { useApp, type MascotKind, type Mode, type Voice } from "@/store/app";
import { cn } from "@/lib/utils";

export default function WelcomePage() {
  const parent = useApp((s) => s.parent);
  const [step, setStep] = useState<0 | 1 | 2>(parent ? 2 : 0);
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }} className="flex flex-1 flex-col">
          {step === 0 && <Intro onNext={() => setStep(1)} />}
          {step === 1 && <ParentStep onNext={() => setStep(2)} />}
          {step === 2 && <ChildStep />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Dots({ i }: { i: number }) {
  return (
    <div className="mb-6 flex justify-center gap-1.5">
      {[0, 1, 2].map((k) => (
        <span key={k} className={cn("h-2 rounded-full transition-all", k === i ? "w-6 bg-primary" : "w-2 bg-muted")} />
      ))}
    </div>
  );
}

function Intro({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <Dots i={0} />
      <div className="bg-hero relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-[2rem] p-6 text-center text-white shadow-lift">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-white/10" />
        <Mascot kind="sao" mood="happy" size={150} />
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Nói Chuẩn</h1>
        <p className="mt-2 max-w-xs text-lg text-white/90">Mỗi ngày 5–10 phút, nói thật rõ l/n, ch/tr, s/x cùng bạn Sáo!</p>
        <div className="mt-4 flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm">
          <SpeakerButton id="ui-welcome" size="sm" className="bg-white text-primary" />
          Nghe lời chào
        </div>
      </div>
      <div className="mt-6 grid gap-3">
        <Button size="lg" onClick={onNext}>
          Bố mẹ bắt đầu <ArrowRight className="h-5 w-5" />
        </Button>
        <Button asChild variant="ghost">
          <Link to="/admin">Tôi là giáo viên / quản trị</Link>
        </Button>
      </div>
    </div>
  );
}

function ParentStep({ onNext }: { onNext: () => void }) {
  const setParent = useApp((s) => s.setParent);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [rec, setRec] = useState(false);
  const [cam, setCam] = useState(false);
  const valid = name.trim() && /\S+@\S+\.\S+/.test(email) && /^\d{4}$/.test(pin) && rec;
  return (
    <div className="flex flex-1 flex-col">
      <Dots i={1} />
      <h1 className="text-3xl font-extrabold tracking-tight">Tài khoản phụ huynh</h1>
      <p className="mt-1 text-muted-foreground">Dữ liệu chỉ lưu trên thiết bị này cho tới khi bật đồng bộ.</p>
      <div className="mt-5 grid gap-3">
        <Field label="Tên phụ huynh" value={name} onChange={setName} placeholder="Ví dụ: Nguyễn Thu Hà" autoComplete="name" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="ten@email.com" type="email" autoComplete="email" />
        <Field label="Mã PIN 4 số (mở bảng phụ huynh)" value={pin} onChange={(v) => setPin(v.replace(/\D/g, "").slice(0, 4))} placeholder="••••" inputMode="numeric" type="password" />
      </div>
      <div className="mt-5 grid gap-3">
        <Consent checked={rec} onChange={setRec} icon={Mic} required title="Tôi đồng ý cho con thu âm giọng đọc" desc="Bắt buộc để chấm phát âm. Âm thanh chỉ dùng để chấm điểm ngay lúc đó, không lưu file ghi âm – chỉ lưu điểm." />
        <Consent checked={cam} onChange={setCam} icon={Camera} title="Cho phép dùng camera ở trò Gương Thần (tùy chọn)" desc="Chỉ hiển thị hình trên máy để con soi gương, không ghi và không lưu hình." />
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <span>Không quảng cáo, không chat, không liên kết ra ngoài, không mua bán trong ứng dụng. Bố mẹ xóa được toàn bộ dữ liệu của con bất cứ lúc nào.</span>
      </div>
      <Disclaimer className="mt-3" />
      <div className="mt-auto pt-6">
        <Button
          size="lg"
          className="w-full"
          disabled={!valid}
          onClick={() => {
            setParent({ name: name.trim(), email: email.trim(), pin, consentRecording: rec, consentCamera: cam, consentAt: new Date().toISOString() });
            onNext();
          }}
        >
          Tiếp tục <ArrowRight className="h-5 w-5" />
        </Button>
        {!rec && <p className="mt-2 text-center text-xs text-muted-foreground">Cần đồng ý thu âm để tiếp tục.</p>}
      </div>
    </div>
  );
}

function ChildStep() {
  const nav = useNavigate();
  const addChild = useApp((s) => s.addChild);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [grade, setGrade] = useState(2);
  const [mode, setMode] = useState<Mode>("kid");
  const [mascot, setMascot] = useState<MascotKind>("sao");
  const [voice, setVoice] = useState<Voice>("bac");
  const [classCode, setClassCode] = useState("");
  return (
    <div className="flex flex-1 flex-col">
      <Dots i={2} />
      <h1 className="text-3xl font-extrabold tracking-tight">Hồ sơ của con</h1>
      <div className="mt-5 grid gap-3">
        <Field label="Tên của con" value={name} onChange={setName} placeholder="Ví dụ: Minh An" />
        <Field label="Biệt danh (hiện trên bảng xếp hạng lớp)" value={nickname} onChange={setNickname} placeholder="Ví dụ: Sóc Nhanh" />
      </div>
      <Label>Lớp</Label>
      <div className="grid grid-cols-9 gap-1.5">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((g) => (
          <button
            key={g}
            onClick={() => {
              setGrade(g);
              setMode(g >= 6 ? "teen" : "kid");
            }}
            className={cn("h-11 rounded-2xl font-bold", g === grade ? "bg-primary text-primary-foreground" : "bg-card shadow-soft")}
          >
            {g}
          </button>
        ))}
      </div>
      <Label>Giao diện</Label>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["kid", "Nhí", "6–10 tuổi · chữ to, nhiều hình", "🧸"],
            ["teen", "Teen", "11–15 tuổi · gọn, có xếp hạng", "🎧"],
          ] as const
        ).map(([m, t, d, e]) => (
          <Choice key={m} active={mode === m} onClick={() => setMode(m)}>
            <span className="text-2xl">{e}</span>
            <span className="font-bold">{t}</span>
            <span className="text-xs text-muted-foreground">{d}</span>
          </Choice>
        ))}
      </div>
      <Label>Chọn bạn đồng hành</Label>
      <div className="grid grid-cols-4 gap-2">
        {(["sao", "meo", "rua", "cun"] as MascotKind[]).map((k) => (
          <Choice key={k} active={mascot === k} onClick={() => setMascot(k)}>
            <Mascot kind={k} size={56} mood={mascot === k ? "happy" : "idle"} />
            <span className="text-xs font-semibold">{mascotName(k)}</span>
          </Choice>
        ))}
      </div>
      <Label>Giọng đọc mẫu</Label>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["bac", "Cô miền Bắc"],
            ["nam", "Cô miền Nam"],
          ] as const
        ).map(([v, t]) => (
          <Choice key={v} active={voice === v} onClick={() => setVoice(v)}>
            <span className="font-bold">{t}</span>
          </Choice>
        ))}
      </div>
      <div className="mt-3">
        <Field label="Mã lớp (nếu thầy cô cung cấp)" value={classCode} onChange={setClassCode} placeholder="Ví dụ: 3A-2026" />
      </div>
      <div className="mt-auto pt-6">
        <Button
          size="lg"
          className="w-full"
          disabled={!name.trim()}
          onClick={() => {
            addChild({ name: name.trim(), nickname: nickname.trim() || name.trim(), grade, mode, mascot, voice, classCode: classCode.trim() || undefined });
            nav("/placement");
          }}
        >
          <Check className="h-5 w-5" /> Vào kiểm tra đầu vào
        </Button>
      </div>
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => <p className="mb-2 mt-5 text-sm font-bold text-muted-foreground">{children}</p>;

function Field({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-2xl border-2 border-input bg-card px-4 text-base outline-none transition focus:border-primary"
        {...rest}
      />
    </label>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button whileTap={{ scale: 0.96 }} onClick={onClick} aria-pressed={active} className={cn("flex flex-col items-center gap-1 rounded-3xl bg-card p-3 text-center shadow-soft ring-2 transition", active ? "ring-primary" : "ring-transparent")}>
      {children}
    </motion.button>
  );
}

function Consent({ checked, onChange, icon: Icon, title, desc, required }: { checked: boolean; onChange: (v: boolean) => void; icon: typeof Lock; title: string; desc: string; required?: boolean }) {
  return (
    <button onClick={() => onChange(!checked)} role="checkbox" aria-checked={checked} className={cn("flex items-start gap-3 rounded-3xl bg-card p-4 text-left shadow-soft ring-2 transition", checked ? "ring-primary" : "ring-transparent")}>
      <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2", checked ? "border-primary bg-primary text-white" : "border-input")}>{checked && <Check className="h-4 w-4" />}</span>
      <span>
        <span className="flex items-center gap-1.5 font-bold">
          <Icon className="h-4 w-4 text-primary" /> {title}
          {required && <span className="text-destructive">*</span>}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}
