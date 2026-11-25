// Bài luyện 4 bước: Nghe → Xem khẩu hình 3D → Phân biệt → Đọc và nhận điểm.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Ear, Gauge, Mic, Rabbit, ScanFace, Snail, Turtle, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Instruction, ItemImage, PageHeader } from "@/components/common";
import { Mouth3D } from "@/components/Mouth3D";
import { MouthDriver } from "@/components/three/driver";
import { MicButton } from "@/components/MicButton";
import { FeedbackPanel } from "@/components/Feedback";
import { MouthDialog } from "@/components/MouthDialog";
import { Mascot } from "@/components/Mascot";
import { SpeakerButton } from "@/components/SpeakerButton";
import { usePractice } from "@/hooks/usePractice";
import { minimalPairsOf, pairById, phonemes, promptText, sentencesOf, wordsOf } from "@/lib/content";
import { playItem, stopAll, type Speed } from "@/lib/audio";
import { celebrate, feedbackFx } from "@/lib/fx";
import { nextDifficulty } from "@/lib/plan";
import { cn, shuffle } from "@/lib/utils";
import { useApp, useChild, useProgress } from "@/store/app";
import type { MinimalPairItem, SentenceItem, WordItem } from "@/lib/types";

const STEPS = [
  { key: "listen", label: "Nghe", icon: Ear },
  { key: "watch", label: "Khẩu hình", icon: ScanFace },
  { key: "pick", label: "Phân biệt", icon: Gauge },
  { key: "speak", label: "Đọc", icon: Mic },
] as const;

/** Phát một mục và cho mô hình 3D chạy theo mốc thời gian. */
export async function playWithMouth(driver: MouthDriver | null, id: string, speed: Speed, restPose: string, voice?: string) {
  const pb = await playItem(id, { speed, voice });
  driver?.play(pb.track, pb.clock, speed === "half");
  await pb.done;
  driver?.stop(restPose);
}

export default function LessonPage() {
  const { pairId = "l-n" } = useParams();
  const pair = pairById(pairId)!;
  const nav = useNavigate();
  const child = useChild()!;
  const progress = useProgress();
  const difficulty = progress.difficulty[pairId] ?? 1;
  const hidden = useApp((s) => s.admin.hiddenItems);
  const [step, setStep] = useState(0);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [t0] = useState(Date.now());
  const [done, setDone] = useState(false);
  // giọng tạm thời cho bài này (vd nghe thêm giọng Nam ở bài ch/tr, s/x)
  const [voiceOverride, setVoiceOverride] = useState<string | undefined>();
  const voiceToggle =
    pair.voiceHint && child.voice !== pair.voiceHint.voice ? (
      <VoiceToggle hint={pair.voiceHint} active={voiceOverride === pair.voiceHint.voice} onChange={(on) => setVoiceOverride(on ? pair.voiceHint!.voice : undefined)} />
    ) : null;

  const content = useMemo(() => {
    const words = wordsOf(pairId).filter((w) => w.difficulty <= difficulty + 1 && !hidden.includes(w.id));
    const bySound = (s: string) => shuffle(words.filter((w) => w.targetSound === s));
    const [a, b] = pair.sounds;
    const listen = [bySound(a)[0], bySound(b)[0], bySound(a)[1], bySound(b)[1]].filter(Boolean);
    const mps = shuffle(minimalPairsOf(pairId).filter((m) => m.difficulty <= difficulty + 1 && !hidden.includes(m.id))).slice(0, 4);
    // ưu tiên từ con hay sai
    const weak = words.slice().sort((x, y) => acc(progress, x.id) - acc(progress, y.id));
    const speakWords = shuffle([...weak.slice(0, 2), ...shuffle(words.filter((w) => !weak.slice(0, 2).includes(w)))]).slice(0, 3);
    const sentence = shuffle(sentencesOf(pairId).filter((s) => s.difficulty <= difficulty + 1))[0];
    const speak: (WordItem | SentenceItem)[] = difficulty >= 2 && sentence ? [...speakWords, sentence] : [...speakWords, ...shuffle(words).slice(0, 1)];
    return { listen, mps, speak };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairId]);

  useEffect(() => () => stopAll(), []);

  const finish = () => {
    const { completeSession, setDifficulty } = useApp.getState();
    const xp = 40 + stats.correct * 10;
    completeSession({ kind: "lesson", activity: pairId, pairId, correct: stats.correct, total: stats.total, durationSec: Math.round((Date.now() - t0) / 1000), xp });
    setDifficulty(pairId, nextDifficulty(difficulty, stats.correct, stats.total));
    setDone(true);
    celebrate();
  };

  if (done) {
    const ratio = stats.total ? stats.correct / stats.total : 0;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
        <Mascot kind={child.mascot} mood="cheer" size={150} outfit={progress.pet.outfit} />
        <h1 className="mt-4 text-3xl font-extrabold">Hoàn thành bài {pair.label}!</h1>
        <div className="my-3 flex gap-1 text-4xl">
          {[1, 2, 3].map((k) => (
            <motion.span key={k} initial={{ scale: 0 }} animate={{ scale: k <= stars ? 1 : 0.7, opacity: k <= stars ? 1 : 0.25 }} transition={{ delay: 0.2 * k, type: "spring" }}>
              ⭐
            </motion.span>
          ))}
        </div>
        <p className="text-lg text-muted-foreground">
          Đọc đúng {stats.correct}/{stats.total} · +{40 + stats.correct * 10} XP
        </p>
        <div className="mt-8 grid w-full gap-2">
          <Button size="lg" onClick={() => nav("/games")}>
            Chơi trò chơi <ArrowRight className="h-5 w-5" />
          </Button>
          <Button variant="ghost" onClick={() => nav("/")}>
            Về trang chủ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-4">
      <PageHeader title={pair.title} subtitle={`Bước ${step + 1}/4 · ${STEPS[step].label}`} close back="/" />
      <div className="mb-4 grid grid-cols-4 gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex flex-col items-center gap-1">
            <Progress value={i < step ? 100 : i === step ? 50 : 0} className="h-2" barClassName={`bg-${pair.color}`} />
            <span className={cn("flex items-center gap-1 text-[11px] font-semibold", i === step ? "text-foreground" : "text-muted-foreground")}>
              <s.icon className="h-3 w-3" /> {s.label}
            </span>
          </div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} transition={{ duration: 0.25 }} className="flex flex-1 flex-col">
          {step === 0 && <ListenStep words={content.listen} pairColor={pair.color} onNext={() => setStep(1)} voice={voiceOverride} voiceToggle={voiceToggle} />}
          {step === 1 && <WatchStep pairId={pairId} words={content.listen} onNext={() => setStep(2)} voice={voiceOverride} voiceToggle={voiceToggle} />}
          {step === 2 && (
            <PickStep
              items={content.mps}
              onAnswer={(c) => setStats((s) => ({ correct: s.correct + (c ? 1 : 0), total: s.total + 1 }))}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <SpeakStep
              items={content.speak}
              onAnswer={(c) => setStats((s) => ({ correct: s.correct + (c ? 1 : 0), total: s.total + 1 }))}
              onNext={finish}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const acc = (p: ReturnType<typeof useProgress>, id: string) => {
  const w = p.wordStats[id];
  return w ? w.c / w.a : 0.5;
};

function SpeedButtons({ speed, setSpeed }: { speed: Speed; setSpeed: (s: Speed) => void }) {
  return (
    <div className="flex gap-1 rounded-2xl bg-muted p-1">
      {(
        [
          ["slow", Snail, "0,75"],
          ["normal", Rabbit, "Thường"],
          ["turtle", Turtle, "Rùa"],
        ] as const
      ).map(([s, Icon, label]) => (
        <button key={s} onClick={() => setSpeed(s)} className={cn("flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold", speed === s ? "bg-card shadow-soft" : "text-muted-foreground")} aria-pressed={speed === s}>
          <Icon className="h-4 w-4" /> {label}
        </button>
      ))}
    </div>
  );
}

function VoiceToggle({ hint, active, onChange }: { hint: { voice: string; note: string }; active: boolean; onChange: (on: boolean) => void }) {
  return (
    <button onClick={() => onChange(!active)} aria-pressed={active} className={cn("mt-3 flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm ring-2 transition", active ? "bg-primary-soft ring-primary" : "bg-card ring-transparent shadow-soft")}>
      <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 text-xs font-bold", active ? "border-primary bg-primary text-white" : "border-input")}>{active ? "✓" : ""}</span>
      <span>
        <b>Nghe giọng {hint.voice === "nam" ? "miền Nam" : "miền Bắc"}</b>
        <span className="block text-muted-foreground">{hint.note}</span>
      </span>
    </button>
  );
}

function ListenStep({ words, onNext, voice, voiceToggle }: { words: WordItem[]; pairColor: string; onNext: () => void; voice?: string; voiceToggle?: React.ReactNode }) {
  const child = useChild()!;
  const [speed, setSpeed] = useState<Speed>("slow");
  const [playing, setPlaying] = useState<string | null>(null);
  const [heard, setHeard] = useState<Set<string>>(new Set());
  const play = async (w: WordItem) => {
    setPlaying(w.id);
    const pb = await playItem(w.id, { speed, voice });
    await pb.done;
    setPlaying(null);
    setHeard((h) => new Set(h).add(w.id));
  };
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3">
        <Mascot kind={child.mascot} mood={playing ? "talk" : "idle"} size={72} />
        <Instruction text={promptText("ui-listen")} promptId="ui-listen" />
      </div>
      <div className="mt-3">
        <SpeedButtons speed={speed} setSpeed={setSpeed} />
      </div>
      {voiceToggle}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {words.map((w) => (
          <motion.button
            key={w.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => play(w)}
            className={cn("bento relative flex flex-col items-center gap-1 p-4 ring-2 transition", playing === w.id ? "ring-primary" : "ring-transparent")}
          >
            <ItemImage image={w.image} className="text-5xl" />
            <span className="text-3xl font-extrabold">{w.text}</span>
            <span className={`rounded-full px-2 text-xs font-bold bg-${phonemeColor(w)}-soft text-${phonemeColor(w)}-ink`}>âm {phonemes[w.targetSound]?.label}</span>
            <Volume2 className={cn("absolute right-3 top-3 h-5 w-5 text-primary", playing === w.id && "animate-pulse")} />
            {heard.has(w.id) && <span className="absolute left-3 top-3 text-sm">✅</span>}
          </motion.button>
        ))}
      </div>
      <Button size="lg" className="mt-auto w-full" onClick={onNext} disabled={heard.size < Math.min(2, words.length)}>
        Xem khẩu hình <ArrowRight className="h-5 w-5" />
      </Button>
      {heard.size < 2 && <p className="mt-2 text-center text-xs text-muted-foreground">Nghe ít nhất 2 từ để tiếp tục</p>}
    </div>
  );
}
const phonemeColor = (w: WordItem) => pairById(w.pairId)?.color ?? "ln";

function WatchStep({ pairId, words, onNext, voice, voiceToggle }: { pairId: string; words: WordItem[]; onNext: () => void; voice?: string; voiceToggle?: React.ReactNode }) {
  const pair = pairById(pairId)!;
  const child = useChild()!;
  const driver = useMemo(() => new MouthDriver(), []);
  const [sound, setSound] = useState(pair.sounds[0]);
  const [busy, setBusy] = useState(false);
  useEffect(() => driver.setPose(sound), [sound, driver]);
  const word = words.find((w) => w.targetSound === sound) ?? words[0];
  const p = phonemes[sound];
  const play = async (speed: Speed) => {
    setBusy(true);
    await playWithMouth(driver, word.id, speed, sound, voice);
    setBusy(false);
  };
  return (
    <div className="flex flex-1 flex-col">
      <Instruction text={promptText("ui-watch")} promptId="ui-watch" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {pair.sounds.map((s) => (
          <button key={s} onClick={() => setSound(s)} className={cn("rounded-2xl py-2 text-lg font-extrabold ring-2", s === sound ? `bg-${pair.color}-soft text-${pair.color}-ink ring-current` : "bg-card ring-transparent")}>
            âm {phonemes[s]?.label}
          </button>
        ))}
      </div>
      <Mouth3D driver={driver} focus={sound} className="mt-3 h-[44dvh] min-h-[280px]" />
      <div className="mt-3 flex items-start gap-3 rounded-3xl bg-card p-4 shadow-soft">
        <SpeakerButton id={`hint-${sound}`} size="sm" />
        <div>
          <p className="font-bold">{child.mode === "teen" ? p?.teenHint : p?.kidHint}</p>
          {p?.tip && <p className="mt-1 text-sm text-muted-foreground">💡 {p.tip}</p>}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => play("slow")}>
          <Volume2 className="h-5 w-5" /> Nghe “{word.text}”
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => play("half")}>
          <Snail className="h-5 w-5" /> Xem chậm 0,5
        </Button>
      </div>
      {voiceToggle}
      <Button size="lg" className="mt-4 w-full" onClick={onNext}>
        Chơi phân biệt <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

function PickStep({ items, onAnswer, onNext }: { items: MinimalPairItem[]; onAnswer: (c: boolean) => void; onNext: () => void }) {
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [truth, setTruth] = useState(() => Math.round(Math.random()));
  const item = items[i];
  const options = item.options;
  useEffect(() => {
    const t = setTimeout(() => playItem(`${item.id}#${truth}`), 350);
    return () => clearTimeout(t);
  }, [item.id, truth]);
  const choose = (k: number) => {
    if (answer !== null) return;
    setAnswer(k);
    const ok = k === truth;
    feedbackFx(ok);
    onAnswer(ok);
    useApp.getState().recordAttempt(item.id, item.pairId, ok);
  };
  const next = () => {
    if (i + 1 >= items.length) return onNext();
    setI(i + 1);
    setAnswer(null);
    setTruth(Math.round(Math.random()));
  };
  return (
    <div className="flex flex-1 flex-col">
      <Instruction text={promptText("ui-discriminate")} promptId="ui-discriminate" />
      <div className="mt-4 flex justify-center">
        <Button variant="soft" size="lg" onClick={() => playItem(`${item.id}#${truth}`)}>
          <Volume2 className="h-6 w-6" /> Nghe lại
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {options.map((o, k) => {
          const state = answer === null ? "idle" : k === truth ? "right" : k === answer ? "wrong" : "idle";
          return (
            <motion.button
              key={k}
              whileTap={{ scale: 0.95 }}
              animate={state === "wrong" ? { x: [0, -8, 8, -4, 0] } : state === "right" ? { scale: [1, 1.06, 1] } : {}}
              onClick={() => choose(k)}
              className={cn(
                "bento flex flex-col items-center gap-2 p-5 ring-4 transition",
                state === "right" ? "ring-success" : state === "wrong" ? "ring-destructive" : "ring-transparent",
              )}
            >
              <ItemImage image={o.image} className="text-6xl" />
              <span className="text-2xl font-extrabold">{o.text}</span>
              <span className="text-xs text-muted-foreground">{o.meaning}</span>
            </motion.button>
          );
        })}
      </div>
      <div className="mt-auto pt-4">
        <p className="mb-2 text-center text-sm text-muted-foreground">
          Câu {i + 1}/{items.length}
        </p>
        <Button size="lg" className="w-full" disabled={answer === null} onClick={next}>
          {i + 1 >= items.length ? "Sang bước đọc" : "Câu tiếp"} <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

function SpeakStep({ items, onAnswer, onNext }: { items: (WordItem | SentenceItem)[]; onAnswer: (c: boolean) => void; onNext: () => void }) {
  const [i, setI] = useState(0);
  const [mouth, setMouth] = useState(false);
  const item = items[i];
  const pr = usePractice({
    onResult: (r) => {
      if (r.status !== "ok") return;
      onAnswer(r.correct);
      useApp.getState().recordAttempt(item.id, item.pairId, r.correct, r.heard);
      // đọc nhầm âm → tự mở mô hình 3D ở tư thế âm đúng
      if (!r.correct && r.targetSound) setTimeout(() => setMouth(true), 1200);
    },
  });
  const target = item.type === "word" ? item.targetSound : (pr.result?.targetSound ?? pairById(item.pairId)!.sounds[0]);
  const next = () => {
    pr.reset();
    if (i + 1 >= items.length) onNext();
    else setI(i + 1);
  };
  return (
    <div className="flex flex-1 flex-col">
      <Instruction text={promptText("ui-speak")} promptId="ui-speak" />
      <AnimatePresence mode="wait">
        <motion.div key={item.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="bento mt-4 flex flex-col items-center gap-2 p-6 text-center">
          {item.type === "word" && <ItemImage image={item.image} className="text-6xl" />}
          <p className={cn("font-extrabold tracking-tight", item.type === "word" ? "text-5xl" : "text-2xl leading-snug")}>{item.text}</p>
          <SpeakerButton id={item.id} label="Nghe mẫu" />
        </motion.div>
      </AnimatePresence>
      <div className="mt-4 min-h-[110px]">
        {pr.error && <p className="rounded-2xl bg-destructive/10 p-3 text-sm font-semibold">{pr.error}</p>}
        {pr.result && (
          <FeedbackPanel
            result={pr.result}
            onRetry={() => pr.reset()}
            onNext={next}
            onShowMouth={() => setMouth(true)}
            onManual={(c) => pr.manualJudge(c)}
            nextLabel={i + 1 >= items.length ? "Hoàn thành" : "Tiếp"}
          />
        )}
      </div>
      <div className="mt-auto flex flex-col items-center pb-2">
        {(!pr.result || pr.result.status === "retry") && (
          <MicButton state={pr.state} level={pr.level} partial={pr.partial} onPress={() => pr.toggle(item.text)} label={pr.state === "recording" ? "Đang nghe… bấm để dừng" : `Bấm và đọc (${i + 1}/${items.length})`} />
        )}
      </div>
      <MouthDialog open={mouth} onOpenChange={setMouth} sound={target} wrongSound={pr.result?.wrongSound} />
    </div>
  );
}
