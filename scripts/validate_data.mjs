// Kiểm tra data/lessons.json & data/phonemes.json: đủ số lượng, id duy nhất, âm/khẩu hình hợp lệ.
import fs from "node:fs";
const L = JSON.parse(fs.readFileSync(new URL("../data/lessons.json", import.meta.url)));
const P = JSON.parse(fs.readFileSync(new URL("../data/phonemes.json", import.meta.url))).phonemes;
let bad = 0;
const fail = (m) => (bad++, console.error("✗", m));
const ids = new Set();
for (const it of L.items) {
  if (ids.has(it.id)) fail(`id trùng: ${it.id}`);
  ids.add(it.id);
  const shapes = it.type === "minimal_pair" ? it.options.map((o) => o.mouthShape) : [it.mouthShape];
  for (const s of shapes) if (!P[s]) fail(`${it.id}: khẩu hình "${s}" không có trong phonemes.json`);
}
for (const p of L.errorPairs) {
  const of = (t) => L.items.filter((i) => i.pairId === p.id && i.type === t).length;
  const need = { word: 20, minimal_pair: 10, sentence: 8, verse: 2 };
  for (const [t, n] of Object.entries(need)) if (of(t) < n) fail(`${p.id}: cần ≥ ${n} ${t}, có ${of(t)}`);
  for (const s of p.sounds) if (!P[s]) fail(`${p.id}: âm "${s}" chưa có tư thế`);
  console.log(`${p.label}: ${of("word")} từ · ${of("minimal_pair")} cặp · ${of("sentence")} câu · ${of("verse")} vè/câu đố`);
}
for (const id of L.placementTest) if (!ids.has(id)) fail(`placementTest: thiếu ${id}`);
for (const k of ["rest", "a", "o", "u", "i", "m", "v", "n", "l", "t", "s", "x", "ch", "tr", "r"]) if (!P[k]) fail(`thiếu tư thế ${k}`);
console.log(bad ? `${bad} lỗi` : "✓ Dữ liệu hợp lệ");
process.exit(bad ? 1 : 0);
