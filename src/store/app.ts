// Trạng thái ứng dụng lưu localStorage (MVP chưa có backend). Xem src/lib/backend.ts + supabase/schema.sql để đồng bộ.
// Quyền riêng tư: KHÔNG lưu file ghi âm của trẻ – chỉ lưu điểm và thống kê.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { todayKey, daysBetween } from "@/lib/utils";
import type { ReviewStatus } from "@/lib/types";

export type Mode = "kid" | "teen";
export type Voice = "bac" | "nam";
export type MascotKind = "sao" | "meo" | "rua" | "cun";

export interface Settings {
  theme: "system" | "light" | "dark";
  sound: boolean;
  haptics: boolean;
  reducedMotion: "system" | "on" | "off";
  render3d: "auto" | "3d" | "image";
}

export interface Parent {
  name: string;
  email: string;
  pin: string; // 4 số – mở bảng phụ huynh
  consentRecording: boolean;
  consentCamera: boolean;
  consentAt: string;
}

export interface Child {
  id: string;
  name: string;
  nickname: string; // biệt danh hiện trên bảng xếp hạng
  grade: number; // 1–9
  mode: Mode;
  mascot: MascotKind;
  voice: Voice;
  classCode?: string;
  createdAt: string;
}

export interface SessionLog {
  id: string;
  date: string; // YYYY-MM-DD
  ts: number;
  kind: "lesson" | "game" | "placement";
  activity: string; // pairId hoặc gameId
  pairId?: string;
  correct: number;
  total: number;
  durationSec: number;
  xp: number;
}

export interface Progress {
  xp: number;
  stars: number;
  streak: number;
  bestStreak: number;
  lastPracticeDay?: string;
  badges: string[];
  sessions: SessionLog[];
  wordStats: Record<string, { a: number; c: number; last: number; heard?: string }>;
  pairStats: Record<string, { a: number; c: number }>;
  difficulty: Record<string, number>; // 1..3 theo cặp lỗi (tự điều chỉnh)
  placement?: { date: string; results: Record<string, { correct: number; total: number }> };
  pet: { food: number; outfit: string | null; unlocked: string[] };
  chestDay?: string;
  gamesPlayed: Record<string, number>;
  records: Record<string, number>; // kỷ lục: tai-thinh-streak, noi-nhanh-best ...
}

export interface Review {
  status: ReviewStatus;
  note?: string;
  updatedAt: string;
  human?: boolean; // đã thay bằng ghi âm người thật (lưu IndexedDB)
}

export interface ClassRoom {
  id: string;
  name: string;
  code: string;
}
export interface Assignment {
  id: string;
  classId: string;
  pairId: string;
  title: string;
  due?: string;
  createdAt: string;
}

export interface AdminState {
  reviews: Record<string, Review>; // khóa `${voice}/${id}`
  missingAudio: Record<string, number>; // id -> số lần phải dùng Web Speech
  classes: ClassRoom[];
  assignments: Assignment[];
  hiddenItems: string[]; // nội dung bị ẩn sau khi duyệt
}

const emptyProgress = (): Progress => ({
  xp: 0,
  stars: 0,
  streak: 0,
  bestStreak: 0,
  badges: [],
  sessions: [],
  wordStats: {},
  pairStats: {},
  difficulty: {},
  pet: { food: 0, outfit: null, unlocked: [] },
  gamesPlayed: {},
  records: {},
});

interface AppState {
  settings: Settings;
  parent: Parent | null;
  children: Child[];
  activeChildId: string | null;
  progress: Record<string, Progress>;
  admin: AdminState;
  /** danh hiệu mới để hiện thông báo */
  toasts: { id: string; kind: "badge" | "level" | "chest"; title: string; emoji: string }[];

  setSettings: (s: Partial<Settings>) => void;
  setParent: (p: Parent | null) => void;
  addChild: (c: Omit<Child, "id" | "createdAt">) => string;
  updateChild: (id: string, c: Partial<Child>) => void;
  setActiveChild: (id: string) => void;
  recordAttempt: (itemId: string, pairId: string | undefined, correct: boolean, heard?: string) => void;
  completeSession: (s: Omit<SessionLog, "id" | "date" | "ts">) => { newBadges: string[] };
  addXp: (xp: number, stars?: number) => void;
  feedPet: (n: number) => void;
  setPetOutfit: (o: string | null) => void;
  unlockOutfit: (o: string) => void;
  openChest: () => { reward: string; emoji: string } | null;
  setPlacement: (results: Record<string, { correct: number; total: number }>) => void;
  setDifficulty: (pairId: string, d: number) => void;
  setRecord: (key: string, v: number) => boolean;
  awardBadge: (id: string) => void;
  dismissToast: (id: string) => void;
  // quản trị
  setReview: (key: string, r: Partial<Review>) => void;
  logMissingAudio: (id: string) => void;
  addClass: (name: string) => void;
  addAssignment: (a: Omit<Assignment, "id" | "createdAt">) => void;
  removeAssignment: (id: string) => void;
  toggleHiddenItem: (id: string) => void;
  // quyền riêng tư
  deleteChildData: (id: string) => void;
  deleteAllData: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const BADGES: Record<string, { title: string; emoji: string; desc: string }> = {
  "first-step": { title: "Bước đầu tiên", emoji: "🌱", desc: "Hoàn thành buổi luyện đầu tiên" },
  "streak-3": { title: "3 ngày liền", emoji: "🔥", desc: "Luyện 3 ngày liên tiếp" },
  "streak-7": { title: "Tuần chăm chỉ", emoji: "🏅", desc: "Luyện 7 ngày liên tiếp" },
  "master-l-n": { title: "Vua L/N", emoji: "🍃", desc: "Đúng ≥ 85% sau 30 lần đọc l/n" },
  "master-ch-tr": { title: "Vua CH/TR", emoji: "🐃", desc: "Đúng ≥ 85% sau 30 lần đọc ch/tr" },
  "master-s-x": { title: "Vua S/X", emoji: "⭐", desc: "Đúng ≥ 85% sau 30 lần đọc s/x" },
  "sharp-ear": { title: "Tai thính", emoji: "👂", desc: "Nghe đúng 10 lần liên tiếp" },
  "bubble-pop": { title: "Thổi bong bóng", emoji: "🫧", desc: "Làm nổ 20 bong bóng trong một lượt" },
  racer: { title: "Tay đua", emoji: "🏎️", desc: "Thắng linh vật ở Đường Đua" },
  "pet-grown": { title: "Người chăm thú", emoji: "🐣", desc: "Nuôi thú cưng lớn tới cấp 3" },
  "verse-reader": { title: "Nghệ sĩ vè", emoji: "🎤", desc: "Đọc trọn một bài vè" },
  "speed-talker": { title: "Nói nhanh", emoji: "⚡", desc: "Đạt 8 từ đúng trong Thử Thách Nói Nhanh" },
  "story-hero": { title: "Người kể chuyện", emoji: "📖", desc: "Đọc hết một truyện tranh" },
  "lesson-5": { title: "Học trò chăm", emoji: "📚", desc: "Hoàn thành 5 bài luyện" },
};

export const OUTFITS: Record<string, { label: string; emoji: string; level: number }> = {
  nonla: { label: "Nón lá", emoji: "👒", level: 2 },
  no: { label: "Nơ xinh", emoji: "🎀", level: 3 },
  kinh: { label: "Kính râm", emoji: "🕶️", level: 4 },
  khan: { label: "Khăn quàng", emoji: "🧣", level: 5 },
  vuongmien: { label: "Vương miện", emoji: "👑", level: 7 },
};

/** Cấp độ từ XP: mỗi cấp cần nhiều XP hơn cấp trước. */
export function levelOf(xp: number) {
  let level = 1;
  let need = 100;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level++;
    need = Math.round(need * 1.25);
  }
  return { level, into: rest, need };
}

export const petStage = (food: number) => (food >= 60 ? 4 : food >= 30 ? 3 : food >= 12 ? 2 : 1);

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      const mutate = (fn: (p: Progress) => void) => {
        const id = get().activeChildId;
        if (!id) return;
        set((s) => {
          const p: Progress = structuredClone(s.progress[id] ?? emptyProgress());
          fn(p);
          return { progress: { ...s.progress, [id]: p } };
        });
      };
      const toast = (t: AppState["toasts"][number]) => set((s) => ({ toasts: [...s.toasts, t] }));
      const checkLevel = (before: number, after: number) => {
        const lb = levelOf(before).level;
        const la = levelOf(after).level;
        if (la > lb) {
          toast({ id: uid(), kind: "level", title: `Lên cấp ${la}!`, emoji: "🎉" });
          for (const [k, o] of Object.entries(OUTFITS)) if (o.level <= la) get().unlockOutfit(k);
        }
      };
      return {
        settings: { theme: "system", sound: true, haptics: true, reducedMotion: "system", render3d: "auto" },
        parent: null,
        children: [],
        activeChildId: null,
        progress: {},
        admin: { reviews: {}, missingAudio: {}, classes: [{ id: "lop-demo", name: "Lớp 3A (mẫu)", code: "3A-2026" }], assignments: [], hiddenItems: [] },
        toasts: [],

        setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),
        setParent: (p) => set({ parent: p }),
        addChild: (c) => {
          const id = uid();
          set((s) => ({
            children: [...s.children, { ...c, id, createdAt: new Date().toISOString() }],
            activeChildId: id,
            progress: { ...s.progress, [id]: emptyProgress() },
          }));
          return id;
        },
        updateChild: (id, c) => set((s) => ({ children: s.children.map((x) => (x.id === id ? { ...x, ...c } : x)) })),
        setActiveChild: (id) => set({ activeChildId: id }),

        recordAttempt: (itemId, pairId, correct, heard) =>
          mutate((p) => {
            const w = (p.wordStats[itemId] ??= { a: 0, c: 0, last: 0 });
            w.a++;
            if (correct) w.c++;
            w.last = Date.now();
            if (!correct && heard) w.heard = heard;
            if (pairId) {
              const ps = (p.pairStats[pairId] ??= { a: 0, c: 0 });
              ps.a++;
              if (correct) ps.c++;
            }
          }),

        completeSession: (s) => {
          const before = get().progress[get().activeChildId ?? ""]?.xp ?? 0;
          const newBadges: string[] = [];
          mutate((p) => {
            const day = todayKey();
            p.sessions.push({ ...s, id: uid(), date: day, ts: Date.now() });
            if (p.sessions.length > 500) p.sessions = p.sessions.slice(-500);
            p.xp += s.xp;
            if (s.total > 0) p.stars += s.correct / s.total >= 0.9 ? 3 : s.correct / s.total >= 0.6 ? 2 : 1;
            // chuỗi ngày
            if (p.lastPracticeDay !== day) {
              const gap = p.lastPracticeDay ? daysBetween(p.lastPracticeDay, day) : 99;
              p.streak = gap === 1 ? p.streak + 1 : 1;
              p.lastPracticeDay = day;
              p.bestStreak = Math.max(p.bestStreak, p.streak);
            }
            if (s.kind === "game") p.gamesPlayed[s.activity] = (p.gamesPlayed[s.activity] ?? 0) + 1;
            const earn = (id: string) => {
              if (!p.badges.includes(id)) {
                p.badges.push(id);
                newBadges.push(id);
              }
            };
            earn("first-step");
            if (p.streak >= 3) earn("streak-3");
            if (p.streak >= 7) earn("streak-7");
            if (p.sessions.filter((x) => x.kind === "lesson").length >= 5) earn("lesson-5");
            for (const [pid, st] of Object.entries(p.pairStats)) if (st.a >= 30 && st.c / st.a >= 0.85) earn(`master-${pid}`);
          });
          newBadges.forEach((b) => toast({ id: uid(), kind: "badge", title: BADGES[b]?.title ?? b, emoji: BADGES[b]?.emoji ?? "🏅" }));
          checkLevel(before, before + s.xp);
          return { newBadges };
        },
        addXp: (xp, stars = 0) => {
          const before = get().progress[get().activeChildId ?? ""]?.xp ?? 0;
          mutate((p) => {
            p.xp += xp;
            p.stars += stars;
          });
          checkLevel(before, before + xp);
        },
        feedPet: (n) =>
          mutate((p) => {
            p.pet.food += n;
            if (petStage(p.pet.food) >= 3 && !p.badges.includes("pet-grown")) {
              p.badges.push("pet-grown");
              toast({ id: uid(), kind: "badge", title: BADGES["pet-grown"].title, emoji: "🐣" });
            }
          }),
        setPetOutfit: (o) => mutate((p) => void (p.pet.outfit = o)),
        unlockOutfit: (o) =>
          mutate((p) => {
            if (!p.pet.unlocked.includes(o)) p.pet.unlocked.push(o);
          }),
        openChest: () => {
          const id = get().activeChildId;
          const p = id ? get().progress[id] : undefined;
          if (!p || p.chestDay === todayKey()) return null;
          const locked = Object.keys(OUTFITS).filter((o) => !p.pet.unlocked.includes(o));
          const roll = Math.random();
          let reward: { reward: string; emoji: string };
          if (locked.length && roll < 0.25) {
            const o = locked[0];
            get().unlockOutfit(o);
            reward = { reward: `Trang phục mới: ${OUTFITS[o].label}`, emoji: OUTFITS[o].emoji };
          } else if (roll < 0.6) {
            const xp = 20 + Math.round(Math.random() * 30);
            get().addXp(xp);
            reward = { reward: `+${xp} XP`, emoji: "✨" };
          } else {
            get().addXp(0, 3);
            reward = { reward: "+3 sao", emoji: "⭐" };
          }
          mutate((pp) => void (pp.chestDay = todayKey()));
          return reward;
        },
        setPlacement: (results) => mutate((p) => void (p.placement = { date: todayKey(), results })),
        setDifficulty: (pairId, d) => mutate((p) => void (p.difficulty[pairId] = Math.max(1, Math.min(3, d)))),
        setRecord: (key, v) => {
          const id = get().activeChildId;
          const old = id ? (get().progress[id]?.records[key] ?? 0) : 0;
          if (v <= old) return false;
          mutate((p) => void (p.records[key] = v));
          return true;
        },
        awardBadge: (b) => {
          const id = get().activeChildId;
          if (!id || get().progress[id]?.badges.includes(b)) return;
          mutate((p) => void p.badges.push(b));
          toast({ id: uid(), kind: "badge", title: BADGES[b]?.title ?? b, emoji: BADGES[b]?.emoji ?? "🏅" });
        },
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

        setReview: (key, r) =>
          set((s) => ({
            admin: {
              ...s.admin,
              reviews: { ...s.admin.reviews, [key]: { ...({ status: "chua_duyet" } as Review), ...s.admin.reviews[key], ...r, updatedAt: new Date().toISOString() } },
            },
          })),
        logMissingAudio: (id) => set((s) => ({ admin: { ...s.admin, missingAudio: { ...s.admin.missingAudio, [id]: (s.admin.missingAudio[id] ?? 0) + 1 } } })),
        addClass: (name) =>
          set((s) => ({
            admin: { ...s.admin, classes: [...s.admin.classes, { id: uid(), name, code: `${name.replace(/\s+/g, "").slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}` }] },
          })),
        addAssignment: (a) => set((s) => ({ admin: { ...s.admin, assignments: [...s.admin.assignments, { ...a, id: uid(), createdAt: new Date().toISOString() }] } })),
        removeAssignment: (id) => set((s) => ({ admin: { ...s.admin, assignments: s.admin.assignments.filter((x) => x.id !== id) } })),
        toggleHiddenItem: (id) =>
          set((s) => ({
            admin: { ...s.admin, hiddenItems: s.admin.hiddenItems.includes(id) ? s.admin.hiddenItems.filter((x) => x !== id) : [...s.admin.hiddenItems, id] },
          })),

        deleteChildData: (id) =>
          set((s) => {
            const progress = { ...s.progress };
            delete progress[id];
            const children = s.children.filter((c) => c.id !== id);
            return { progress, children, activeChildId: children[0]?.id ?? null };
          }),
        deleteAllData: () => set({ parent: null, children: [], activeChildId: null, progress: {}, toasts: [] }),
      };
    },
    {
      name: "noi-chuan-v1",
      version: 1,
      partialize: (s) => ({ settings: s.settings, parent: s.parent, children: s.children, activeChildId: s.activeChildId, progress: s.progress, admin: s.admin }),
    },
  ),
);

// Hook tiện dụng
export const useChild = () => useApp((s) => s.children.find((c) => c.id === s.activeChildId) ?? null);
export const useProgress = () => useApp((s) => (s.activeChildId ? s.progress[s.activeChildId] : undefined)) ?? emptyProgress();
export { emptyProgress };
