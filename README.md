# Nói Chuẩn – MVP

Ứng dụng web (PWA, ưu tiên điện thoại) giúp học sinh lớp 1–9 sửa lỗi ngọng **l/n, ch/tr, s/x** qua các buổi luyện 5–10 phút: nghe giọng mẫu chậm 0,75 → xem khẩu hình 3D → phân biệt → đọc và được chấm điểm ngay.

> Ứng dụng chỉ hỗ trợ luyện phát âm. Nếu con gặp khó khăn kéo dài, nên gặp chuyên viên âm ngữ trị liệu.

## Chạy nhanh

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # bản PWA trong dist/
npm run validate:data
```

Mã trang quản trị bản MVP: `giaovien` (đổi bằng biến môi trường `VITE_ADMIN_CODE`).

## Cài như app trên điện thoại (GitHub Pages)

1. Đẩy code lên nhánh `main`. Workflow `.github/workflows/deploy.yml` tự kiểm tra (dữ liệu + test), build và đẩy bản build
   lên nhánh `gh-pages` (nếu Pages chưa bật: **Settings → Pages → Deploy from a branch → gh-pages / root**).
2. Mở `https://<tên-tài-khoản>.github.io/<tên-repo>/` bằng **Chrome trên Android** → menu ⋮ → **Thêm vào màn hình chính / Cài đặt ứng dụng**.
   Trên iPhone: mở bằng **Safari** → nút Chia sẻ → **Thêm vào MH chính**.
3. App có icon riêng, mở toàn màn hình, dùng được khi mất mạng (trừ nhận dạng giọng nói của Chrome cần mạng).

App dùng đường dẫn tương đối (`base: "./"`) và định tuyến bằng `#` nên chạy được ở bất kỳ thư mục nào, không cần cấu hình thêm.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `data/lessons.json` | Cặp lỗi, 72 từ, 30 cặp từ, 24 câu, 6 vè/câu đố, 3 truyện, 15 từ kiểm tra đầu vào, lời nhắc |
| `data/phonemes.json` | 15 tư thế khẩu hình (rest, a, o, u, i, m, v, n, l, t, s, x, ch, tr, r) + tên bộ phận tiếng Việt |
| `scripts/generate_audio.py` | Tạo giọng mẫu bằng VieNeu‑TTS (bản 0,75 + bản thường + manifest có mốc thời gian) |
| `scripts/render_mouth.mjs` | Render ảnh/video khẩu hình dự phòng cho máy yếu → `public/mouth/` |
| `src/components/three/` | Mô hình 3D tạm, hệ thống tư thế (morph targets/xương), luồng hơi, nhãn |
| `src/lib/scoring.ts` | `scorePronunciation(audio, targetText)` → `{score, wrongSound, feedback}` |
| `src/components/games/` | 10 trò chơi dùng chung dữ liệu + module chấm điểm |
| `src/store/app.ts` | Trạng thái (localStorage): hồ sơ, tiến bộ, phần thưởng, trạng thái duyệt giọng |
| `supabase/schema.sql` | Lược đồ + RLS khi bật backend |

## Dữ liệu bài học (`data/lessons.json`)

Mỗi mục có `id`, `type` (`word` · `minimal_pair` · `sentence` · `verse`), `pairId` (cặp lỗi), `targetSound` (âm mục tiêu), `confusableSound`, `mouthShape` (khẩu hình, khóa trong `phonemes.json`), `difficulty` (1–3), `image` (`{emoji}` hoặc `{src}`).

**Thêm cặp lỗi mới (r/d/gi, vần cuối, thanh điệu):**
1. Thêm vào `errorPairs` với `category`: `initial` (phụ âm đầu) · `final` (vần cuối) · `tone` (thanh điệu).
2. Thêm tư thế mới vào `phonemes.json` nếu cần (vd `gi`, `ng`) – chỉ là bộ tham số.
3. Thêm mục `word/minimal_pair/sentence/verse` với `pairId` mới; chạy `npm run validate:data`.
4. Chạy lại `generate_audio.py` (chỉ tạo phần mới).
   Bộ phát hiện "đọc nhầm âm" trong `scoring.ts` hiện so sánh **phụ âm đầu**; với vần cuối/thanh điệu cần thêm hàm so sánh tương ứng trong `sylSim()`.

## Giọng đọc mẫu (VieNeu‑TTS)

App **không gọi TTS trực tiếp** – mọi âm thanh là file tĩnh trong `public/audio/`.

1. Cài VieNeu‑TTS, **ghim commit** đã thử (`scripts/voices.json` → `vieneu_commit`):
   ```bash
   git clone https://github.com/kkauto-net/repo-VieNeu-TTS vieneu && cd vieneu
   git checkout 3206ed960e317e69bfe09f9d553aecbf1090f32e
   uv sync                 # CPU (ONNX, giữ mặc định fp32 – đừng dùng int8 nếu CPU không có VNNI)
   # uv sync --extra cuda  # GPU
   uv pip install -r ../noi-chuan/scripts/requirements-audio.txt   # whisperX (forced alignment), pyrubberband
   ```
2. Cài **ffmpeg có filter rubberband** (`ffmpeg -filters | grep rubberband`). Không có thì script tự dùng `pyrubberband` hoặc CLI `rubberband -T 0.75 --formant`.
3. Chọn giọng: `uv run python ../noi-chuan/scripts/generate_audio.py --list-voices`, nghe thử rồi sửa `scripts/voices.json` (mặc định: Bắc = "Mai Anh", Nam = "Thùy Dung"). Hoặc đặt `ref_audio` = file 3–8 giây của giáo viên **đã ký đồng ý** (đọc chậm, rõ).
4. Tạo âm thanh (chạy lại chỉ tạo mục mới/đổi nội dung – so hash):
   ```bash
   uv run python ../noi-chuan/scripts/generate_audio.py                # cả 2 giọng
   uv run python ../noi-chuan/scripts/generate_audio.py --voices bac --limit 5   # thử nhanh
   uv run python ../noi-chuan/scripts/generate_audio.py --backend onnx --device cpu
   ```
   Mỗi mục: TTS → kéo chậm 0,75 (giữ cao độ & formant) → cắt lặng → −16 LUFS → MP3 44,1 kHz 128 kbps →
   `public/audio/<giong>/<id>.mp3` (0,75) và `public/audio/<giong>/normal/<id>.mp3` → mốc âm tiết/âm vị (whisperX, không có thì ước lượng) → `public/audio/manifest.json` với `status: "chua_duyet"`.
5. Giáo viên duyệt ở **Trang quản trị → Giọng mẫu** (nghe, Đạt/Đọc sai, ghi chú, tải ghi âm người thật thay thế). Nút "Xuất trạng thái duyệt" tạo `audio-reviews.json` để gộp vào manifest (hoặc lưu Supabase bảng `audio_reviews`).
6. **Commit thư mục `public/audio`** để PWA tải trước.

Trong app: mặc định phát bản 0,75; "Thường" phát bản normal; "Rùa" phát bản 0,75 với `playbackRate 0.8` (≈0,6, `preservesPitch`). Chỉ phát file **đã duyệt**; thiếu/chưa duyệt → Web Speech API (vi‑VN, 0,75) và ghi vào danh sách cảnh báo trong trang quản trị.

**Tự kiểm tra bằng ASR (khuyến nghị):**
```bash
uv pip install faster-whisper
uv run python ../noi-chuan/scripts/generate_audio.py --verify medium --aligner whisper --auto-approve
```
- Từ đơn/cụm 2 âm tiết được đọc trong câu đệm "Con đọc: …" (VieNeu đọc lệch khi đầu vào quá ngắn) rồi cắt theo mốc thời gian từng từ.
- `--verify medium`: faster-whisper nghe lại; nếu lệch thì tạo lại tối đa 3 lần, giữ bản khớp nhất.
- `--aligner whisper`: mốc âm tiết từ faster-whisper (không cần PyTorch/whisperX).
- `--auto-approve`: file khớp ASR được đánh dấu `da_duyet` kèm ghi chú; file lệch giữ `chua_duyet` và hiện ở bộ lọc **"ASR nghe lệch"** trong trang quản trị. ASR (dữ liệu giọng Bắc) không phân biệt s/x, ch/tr, d/gi/r nên các cặp này vẫn cần giáo viên nghe tai.

Kiểm thử pipeline không cần mô hình: `python scripts/generate_audio.py --engine mock --aligner estimate --out /tmp/audio-test` (engine giả lập, không ghi vào `public/audio`).

## Khẩu hình 3D

**Gương mặt người thật theo lứa tuổi** (mặc định): Nhí dùng gương mặt trẻ em, Teen dùng gương mặt thiếu niên; phụ huynh chọn bạn trai/bạn gái
trong hồ sơ. Đầu dạng tượng xám, môi – hàm – lưỡi cử động bằng 15 viseme chuẩn theo bảng `face` trong `data/phonemes.json`.
Ở mặt cắt dọc, đường viền đầu được tính từ chính lưới đầu (đã áp biểu cảm) mỗi khung hình; khoang miệng giải phẫu được đặt khớp
khe môi – đầu mũi của gương mặt. Nguồn mô hình: Microsoft Rocketbox (MIT) – xem `public/models/heads/README.md`.
Cài đặt → Khẩu hình → "Sơ đồ" để dùng lại mô hình sơ đồ.


- Mô hình tạm dựng bằng khối cơ bản, **đúng tên bộ phận** (`lip_upper`, `lip_lower`, `teeth_upper/lower`, `gum`, `alveolar_ridge`, `hard_palate`, `soft_palate`, `uvula`, `tongue`, `jaw`, `nasal_cavity`, `pharynx`, `epiglottis`).
- Lưỡi và môi dùng **morph targets** tên trùng tham số trong `phonemes.json`; hàm (`jaw_pivot`) và vòm mềm (`velum_pivot`) xoay như xương.
- 3 chế độ: mặt cắt dọc (mặc định, kiểu hình giải phẫu sách giáo khoa) · nhìn thẳng (môi, độ mở hàm) · xuyên thấu. OrbitControls giới hạn góc.
- Đồng bộ với giọng mẫu theo mốc trong manifest; nút xem chậm 0,5; luồng hơi (miệng/mũi/hai bên lưỡi/rãnh hẹp/bật hơi); nhãn tiếng Việt; so sánh 2 âm.
- **Thay mô hình thật:** đặt `public/models/vocal_tract.glb` (nén Draco, < 5 MB). App tự phát hiện và dùng `GlbTract` – cần mesh/morph target/node đặt tên như trên. Bộ giải mã Draco có sẵn trong `public/draco/` (chạy offline).
- Máy không có WebGL / yếu / dưới 18 fps liên tục → tự chuyển sang ảnh render sẵn trong `public/mouth/` (đổi theo âm đang phát). Tạo lại: `npm run dev` rồi `npm run render:mouth`.

> **Lưu ý s/x:** `phonemes.json` mô tả **s = uốn lưỡi [ʂ]**, **x = lưỡi thẳng, đầu lưỡi sau răng dưới [s]** – theo cách dạy phổ biến ("tr, s, r uốn lưỡi"). Muốn đổi, chỉ cần sửa `params` của `s`/`x`.

## Chấm phát âm

`scorePronunciation(audio, targetText)` (`src/lib/scoring.ts`):
1. Âm lượng quá nhỏ/không có tiếng → nhắc đọc lại, **không trừ điểm**.
2. Có `VITE_SCORING_API_URL` → gửi `multipart/form-data` (`audio`, `text`, `lang=vi-VN`), nhận `{score, transcript?, wrongSound?}`.
3. Không có API → Web Speech `SpeechRecognition` (vi‑VN, 5 phương án) → căn âm tiết → phát hiện đổi phụ âm đầu (l↔n, ch↔tr, s↔x) → góp ý xưng "con" bằng chữ + giọng; tự mở mô hình 3D ở tư thế âm đúng.
4. Trình duyệt không hỗ trợ nhận dạng (một số bản Firefox) → người lớn chấm tay (Đúng/Chưa đúng).

Giới hạn: nhận dạng giọng nói tổng quát hay "tự sửa" về từ có nghĩa, nên có thể bỏ sót lỗi ngọng nhẹ; Chrome cần mạng cho nhận dạng. Nên thay bằng API chấm phát âm chuyên dụng khi có.

## An toàn trẻ em

Không quảng cáo, chat, liên kết ngoài hay mua bán. Thu âm chỉ sau khi phụ huynh đồng ý; camera (Gương Thần) cần đồng ý riêng, chỉ hiển thị trên máy, không ghi. Không lưu file ghi âm – chỉ lưu điểm. Xếp hạng chỉ biệt danh, chỉ trong lớp. Phụ huynh xóa được toàn bộ dữ liệu (Bảng phụ huynh, khóa PIN).

## Trạng thái MVP

- Dữ liệu lưu **localStorage** (có `src/lib/backend.ts` + `supabase/schema.sql` để nối Supabase).
- Bảng xếp hạng lớp dùng **dữ liệu mẫu** cho bạn cùng lớp tới khi có máy chủ.
- Linh vật là SVG + Framer Motion (giữ nguyên props `kind/mood/outfit` khi thay bằng Lottie/Rive).
