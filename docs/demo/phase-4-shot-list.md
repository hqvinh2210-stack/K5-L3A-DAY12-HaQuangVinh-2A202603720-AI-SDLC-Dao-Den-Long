# Kịch bản quay demo Phase 4

Video MP4 dưới 5 phút. Chuẩn bị sẵn ván đang chơi và chạy benchmark ở terminal riêng để có thể cho thấy kết quả trong thời lượng quay.

| Mốc | Nội dung cần quay trực tiếp |
| --- | --- |
| 0:00–0:30 | Menu tiếng Việt, đặt tên, mở bảng xếp hạng, bật chữ lớn và giảm chuyển động. |
| 0:30–1:20 | Chơi một đoạn thật. Nhặt đom đóm, Lướt, Tỏa Sáng, thắp hoặc châm dầu. Cho thấy thanh dầu và mục tiêu bình minh. |
| 1:20–2:00 | Mở kết quả thua hoặc Bình Minh đã chuẩn bị, lưu tên hợp lệ, quay lại bảng xếp hạng. |
| 2:00–3:40 | Cho thấy đầu ra thực của kiểm thử, headless, benchmark và hai tệp báo cáo. |
| 3:40–4:20 | Cho thấy lệnh xuất bảng điểm, tag Phase 4 và cách chạy gói web. |

```sh
npm test
node src/headless.mjs --seed 42 --night 3 --ticks 18000 --out headless.jsonl
node src/bench.mjs --seed 42 --duration 30 --out bench.json
node --expose-gc src/soak.mjs --seed 7 --nights 10 --out soak.json
node src/serve.mjs --export-leaderboard diem.json
```

Sau khi quay, mở lại video để xác nhận âm thanh, chữ và thời lượng, rồi dùng danh sách bước ở [trang phát hành](../release/README.md).
