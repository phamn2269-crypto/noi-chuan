// Danh mục trò chơi – dùng chung dữ liệu JSON và module chấm điểm.
export interface GameDef {
  id: string;
  title: string;
  emoji: string;
  desc: string;
  minutes: string;
  unlockLevel: number;
  teenOnly?: boolean;
  needsMic: boolean;
  gradient: string;
}
export const GAMES: GameDef[] = [
  { id: "tai-thinh", title: "Tai Thính", emoji: "👂", desc: "Nghe từ, chọn hình đúng – càng đúng càng nhanh", minutes: "1–2 phút", unlockLevel: 1, needsMic: false, gradient: "from-violet-500 to-indigo-500" },
  { id: "bong-bong", title: "Bong Bóng Âm", emoji: "🫧", desc: "Đọc đúng từ trong bong bóng để làm nổ", minutes: "2 phút", unlockLevel: 1, needsMic: true, gradient: "from-sky-400 to-cyan-500" },
  { id: "duong-dua", title: "Đường Đua Phát Âm", emoji: "🏎️", desc: "Đọc đúng để xe chạy nhanh, đua với linh vật", minutes: "2 phút", unlockLevel: 1, needsMic: true, gradient: "from-orange-400 to-rose-500" },
  { id: "thu-cung", title: "Nuôi Thú Cưng", emoji: "🐣", desc: "Mỗi từ đúng là một phần thức ăn", minutes: "2–3 phút", unlockLevel: 1, needsMic: true, gradient: "from-emerald-400 to-teal-500" },
  { id: "doc-ve", title: "Đọc Vè – Đố Vui", emoji: "🎤", desc: "Đọc vè, câu đố theo chữ chạy karaoke", minutes: "2–3 phút", unlockLevel: 1, needsMic: true, gradient: "from-fuchsia-500 to-pink-500" },
  { id: "phan-loai", title: "Phân Loại Từ", emoji: "🧺", desc: "Kéo từ vào đúng giỏ rồi đọc to cả giỏ", minutes: "2 phút", unlockLevel: 2, needsMic: true, gradient: "from-amber-400 to-orange-500" },
  { id: "bac-si", title: "Bác Sĩ Ngọng", emoji: "🩺", desc: "Tìm lỗi linh vật đọc sai và đọc lại đúng", minutes: "2 phút", unlockLevel: 2, needsMic: true, gradient: "from-teal-400 to-emerald-600" },
  { id: "guong-than", title: "Gương Thần 3D", emoji: "🪞", desc: "Soi gương so khẩu hình với mô hình 3D", minutes: "2 phút", unlockLevel: 3, needsMic: true, gradient: "from-indigo-500 to-purple-600" },
  { id: "truyen", title: "Truyện Tranh", emoji: "📖", desc: "Đọc đúng một câu để lật trang", minutes: "3 phút", unlockLevel: 3, needsMic: true, gradient: "from-rose-400 to-red-500" },
  { id: "noi-nhanh", title: "Thử Thách Nói Nhanh", emoji: "⚡", desc: "Đọc chuỗi từ dễ nhầm thật nhanh và đúng", minutes: "1 phút", unlockLevel: 1, teenOnly: true, needsMic: true, gradient: "from-slate-700 to-indigo-700" },
];
export const gameById = (id: string) => GAMES.find((g) => g.id === id);
