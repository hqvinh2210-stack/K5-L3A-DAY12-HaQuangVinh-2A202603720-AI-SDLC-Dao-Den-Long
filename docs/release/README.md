# Danh sách bước phát hành v1.0.0

## Việc người nộp thực hiện

1. Thay `mssv-ho-ten` trong `game.contract.json` bằng MSSV và họ tên. Điền số token, chi phí ở [retro](../notes/retro-phase-4.md); kiểm tra lại rồi commit và push. Nếu commit thông tin sau tag Phase 4, tạo tag phiên bản trên commit đã duyệt.
2. Đo lại bằng máy chấm: `node src/bench.mjs --seed 42 --duration 30 --out bench-grading.json`. Ghi kết quả thật, kiểm tra ≥60 FPS trung bình, 1% thấp ≥30 FPS và tải ≤10.000 ms.
3. Quay `demo.mp4` dưới 5 phút theo [kịch bản quay](../demo/phase-4-shot-list.md). Kiểm tra tựa, tiếng Việt và log hiển thị trước khi tải lên.
4. Kiểm tra trên GitHub rằng `main` và `phase-4` ở repo công khai. Nếu cần đẩy từ một checkout chưa có remote, chạy `git push <URL-repo> main phase-4`. Không đẩy lại bằng force.
5. Tạo gói và xuất bản Release bằng các lệnh bên dưới. Ghi chú mẫu nằm trong `docs/release/v1.0.0-notes.md`.

```sh
npm run build:release
tar -czf dist/dao-den-long-v1.0.0.tar.gz -C dist dao-den-long-v1.0.0
gh release create v1.0.0 --target main --title "Đảo Đèn Lồng v1.0.0" --notes-file docs/release/v1.0.0-notes.md dist/dao-den-long-v1.0.0.tar.gz demo.mp4
```

Nếu chưa có GitHub CLI, tạo **New release** trên GitHub, chọn tag mới `v1.0.0` trỏ tới commit đã kiểm tra, dán ghi chú và đính kèm hai tệp trước khi bấm **Publish release**. Tải lại gói web từ Release, giải nén và thử theo `CHAY.md`.

## Giấy phép

Tệp `LICENSE` ghi trạng thái giấy phép hiện tại do chủ repo chưa chọn giấy phép phân phối. Chủ repo xác nhận điều khoản áp dụng trước khi xuất bản Release.
