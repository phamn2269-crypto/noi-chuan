# Gương mặt mẫu cho khẩu hình 3D

| File | Lứa tuổi | Nguồn |
|---|---|---|
| `child_f.glb` | Nhí (6–10) – bạn gái | Microsoft Rocketbox `Female_Child_01` |
| `child_m.glb` | Nhí (6–10) – bạn trai | Microsoft Rocketbox `Male_Child_01` |
| `teen_f.glb` | Teen (11–15) – bạn gái | Microsoft Rocketbox `Female_Adult_03` |
| `teen_m.glb` | Teen (11–15) – bạn trai | Microsoft Rocketbox `Male_Adult_10` |

Nguồn: [Microsoft Rocketbox Avatar Library](https://github.com/microsoft/Microsoft-Rocketbox) – giấy phép MIT (xem `LICENSE-Rocketbox.md`).

Đã xử lý bằng `scripts/heads/convert.html`: chỉ giữ phần đầu (bỏ thân, cắt ngang cổ), tính sẵn tư thế gốc của khung xương,
đổi hệ trục (mặt hướng +x, đơn vị cm), tách lưới `skin` / `eyes` / `teeth` / `tongue` / `hair`, giữ 28 biểu cảm cần cho phát âm:
15 viseme (`sil PP FF TH DD kk CH SS nn RR aa E I O U`) và `jawOpen mouthClose mouthFunnel mouthPucker mouthPress mouthRollLower
mouthStretch mouthSmile tongueUp tongueDown tongueOut tongueIn blink`. Bỏ texture – app tô chất liệu tượng xám.

Thêm gương mặt khác: lấy `*_facial.fbx` của nhân vật Rocketbox, sửa danh sách trong `scripts/heads/convert.cjs`, chạy lại.
