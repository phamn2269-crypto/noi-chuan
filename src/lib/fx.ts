// Âm thanh nhỏ (tạo bằng WebAudio, không cần file), rung nhẹ và pháo giấy – tôn trọng cài đặt.
import confetti from "canvas-confetti";
import { useApp } from "@/store/app";
import { prefersReducedMotion } from "./device";

let ctx: AudioContext | null = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return ctx;
}
function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.12) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

export function reducedMotion() {
  const s = useApp.getState().settings.reducedMotion;
  return s === "on" || (s === "system" && prefersReducedMotion());
}

export const sfx = {
  correct() {
    if (!useApp.getState().settings.sound) return;
    tone(660, 0, 0.12, "triangle");
    tone(990, 0.09, 0.2, "triangle");
  },
  wrong() {
    if (!useApp.getState().settings.sound) return;
    tone(320, 0, 0.16, "sine", 0.09);
    tone(250, 0.12, 0.22, "sine", 0.08);
  },
  pop() {
    if (!useApp.getState().settings.sound) return;
    tone(880 + Math.random() * 200, 0, 0.08, "square", 0.05);
  },
  tap() {
    if (!useApp.getState().settings.sound) return;
    tone(520, 0, 0.05, "sine", 0.05);
  },
  win() {
    if (!useApp.getState().settings.sound) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.25, "triangle", 0.1));
  },
};

export function haptic(kind: "ok" | "bad" | "tap" = "tap") {
  if (!useApp.getState().settings.haptics || !navigator.vibrate) return;
  navigator.vibrate(kind === "ok" ? 25 : kind === "bad" ? [40, 60, 40] : 10);
}

export function celebrate() {
  sfx.win();
  if (reducedMotion()) return;
  const colors = ["#5b4cf0", "#22c7b8", "#ff7a59", "#ffc83d", "#ec4f9c"];
  confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, colors, disableForReducedMotion: true });
  setTimeout(() => confetti({ particleCount: 60, spread: 110, origin: { y: 0.6 }, colors, disableForReducedMotion: true }), 250);
}

export function feedbackFx(correct: boolean) {
  if (correct) {
    sfx.correct();
    haptic("ok");
  } else {
    sfx.wrong();
    haptic("bad");
  }
}
