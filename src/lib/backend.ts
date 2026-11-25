// Lớp trừu tượng lưu trữ. MVP: LocalBackend (zustand persist → localStorage, xem src/store/app.ts).
// Để đồng bộ Supabase: cài @supabase/supabase-js, tạo bảng theo supabase/schema.sql,
// rồi hiện thực SupabaseBackend với cùng giao diện và gọi từ các action trong store.
import type { SessionLog } from "@/store/app";

export interface Backend {
  saveSession(childId: string, s: SessionLog): Promise<void>;
  saveAttempt(childId: string, itemId: string, pairId: string | undefined, correct: boolean, heard?: string): Promise<void>;
  deleteChild(childId: string): Promise<void>;
  setAudioReview(key: string, status: string, note?: string): Promise<void>;
}

export const LocalBackend: Backend = {
  async saveSession() {},
  async saveAttempt() {},
  async deleteChild() {},
  async setAudioReview() {},
};

export const backend: Backend = LocalBackend;
