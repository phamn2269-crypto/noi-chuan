import { phonemes } from "./content";

/** Gợi ý khẩu hình ngắn cho một âm (xưng "con" ở chế độ Nhí). */
export function hintFor(sound: string, mode: "kid" | "teen" = "kid") {
  const p = phonemes[sound];
  if (!p) return "Con nghe kỹ và đọc lại";
  return mode === "kid" ? p.kidHint.replace(/[.!]+$/, "") : p.teenHint;
}
