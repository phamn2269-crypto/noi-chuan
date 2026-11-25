// Render ảnh (và video ngắn) khẩu hình dự phòng cho máy không có WebGL / máy yếu → public/mouth/
//   npm run dev            (cửa sổ khác)
//   npm run render:mouth   [-- http://localhost:5173]
// Cần Playwright + Chromium (npx playwright install chromium) và ffmpeg.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public", "mouth");
const BASE = process.argv[2] ?? "http://localhost:5173";
const phonemes = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "data", "phonemes.json"), "utf8")).phonemes);
const VIEWS = ["side", "front", "xray"];
const VIDEO_POSES = ["n", "l", "ch", "tr", "s", "x"];
fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mouth-"));
const args = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];

const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
for (const pose of phonemes)
  for (const view of VIEWS) {
    await page.goto(`${BASE}/#/render?pose=${pose}&view=${view}&labels=focus`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
    await page.waitForTimeout(400);
    const png = path.join(tmp, `${pose}_${view}.png`);
    await page.screenshot({ path: png });
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", png, "-quality", "82", path.join(OUT, `${pose}_${view}.webp`)]);
    console.log("✓", `${pose}_${view}.webp`);
  }
await browser.close();

// video ngắn (nghỉ → tư thế → nghỉ), mặt cắt dọc
for (const pose of VIDEO_POSES) {
  const b = await chromium.launch({ args });
  const ctx = await b.newContext({ viewport: { width: 480, height: 480 }, recordVideo: { dir: tmp, size: { width: 480, height: 480 } } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/#/render?pose=${pose}&view=side&labels=focus&anim=1`);
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  const video = p.video();
  await ctx.close();
  const webm = await video.path();
  // bỏ phần tải trang ở đầu (≈ 1,2 s)
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "1.2", "-i", webm, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "28", "-movflags", "+faststart", path.join(OUT, `${pose}.mp4`)]);
  await b.close();
  console.log("✓", `${pose}.mp4`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Xong → ${OUT}`);
