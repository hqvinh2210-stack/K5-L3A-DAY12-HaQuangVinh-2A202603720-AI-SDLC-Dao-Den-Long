# Hướng dẫn làm việc với LAB12

- Giữ `game.contract.json` và `src/maps.mjs` là nguồn thông số và bản đồ dùng chung. Renderer chỉ đọc trạng thái, CLI chạy cố định 60 tick/giây.
- Giữ dầu nguyên theo đơn vị 1/60 và kiểm tra thứ tự theo [ADR 003](docs/adr/003-den-can-dau.md). `tick` tính cả tạm dừng, còn `sim_tick` chỉ tính thời gian chơi.
- Cảnh benchmark và soak cô lập với luật chơi thường. Benchmark dùng cùng renderer, tắt các hiệu ứng sáng tạo bổ sung. Lưu JSON thật, so đầu ra headless theo byte với tag trước, rồi chạy `npm test`.
- Tách cài đặt, tên hiển thị và bảng xếp hạng khỏi mô phỏng. Tất cả chữ người chơi thấy dùng tiếng Việt có dấu. Tạo bằng chứng cho cả cách cài ở checkout sạch và gói web.
- Dùng [skill lantern-contract](.claude/skills/lantern-contract/SKILL.md). Làm theo các bước của chủ repo trong [danh sách phát hành](docs/release/README.md).
