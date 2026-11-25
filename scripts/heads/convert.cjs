// Chuyển nhân vật Microsoft Rocketbox (FBX có 175 biểu cảm) → GLB phần đầu cho khẩu hình 3D.
// 1) Lấy file *_facial.fbx từ https://github.com/microsoft/Microsoft-Rocketbox (Assets/Avatars/.../Export/)
//    đặt cạnh convert.html với tên m.fbx, f.fbx, tm.fbx, tf.fbx (hoặc sửa danh sách JOBS).
// 2) Tạo thư mục phục vụ:  ln -s ../../node_modules scripts/heads/nm  &&  (cd scripts/heads && python3 -m http.server 8090)
// 3) node scripts/heads/convert.cjs public/models/heads
const { chromium } = require("playwright");
const fs = require("fs");
const JOBS = [["m.fbx", "child_m.glb"], ["f.fbx", "child_f.glb"], ["tm.fbx", "teen_m.glb"], ["tf.fbx", "teen_f.glb"]];
(async () => {
  const out = process.argv[2] ?? "public/models/heads";
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on("pageerror", (e) => console.log("ERR", e.message));
  await p.goto("http://127.0.0.1:8090/convert.html");
  await p.waitForFunction(() => window.__ready);
  for (const [f, name] of JOBS) {
    if (!fs.existsSync(`${__dirname}/${f}`)) continue;
    const r = await p.evaluate((f) => window.__run(f), f);
    fs.writeFileSync(`${out}/${name}`, Buffer.from(r.b64, "base64"));
    console.log(name, r.bytes, JSON.stringify(r.stats));
  }
  await b.close();
})();
