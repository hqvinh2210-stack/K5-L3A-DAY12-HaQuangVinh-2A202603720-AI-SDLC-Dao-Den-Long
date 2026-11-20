# Hướng dẫn làm việc với LAB12

- `game.contract.json` và `src/maps.mjs` là nguồn thông số, bản đồ dùng chung giữa WebGL và CLI.
- Giữ dầu nguyên theo đơn vị 1/60. Bước 2 trừ dầu tự hao và dầu bị hút, rồi tắt đèn cạn trước bước di chuyển. Kiểm tra thứ tự cập nhật theo [ADR 003](docs/adr/003-den-can-dau.md).
- `tick` tính cả tạm dừng, `sim_tick` chỉ tính thời gian chơi. Kịch bản không phát sự kiện, điểm hoặc tăng sức chứa ở tick 0. Hết Ngọn Lửa luôn được xét trước kết quả bình minh.
- Bảo vệ hồi quy qua CLI thật bằng `npm test`. Khi thay hành vi hợp đồng, cập nhật hoặc ghi lý do bỏ ca cũ trong bằng chứng của phase.
- Mọi chữ người chơi thấy dùng tiếng Việt có dấu. Tính năng mỹ thuật và âm thanh ngoài hợp đồng chỉ nằm ở client.
- Dùng [skill lantern-contract](.claude/skills/lantern-contract/SKILL.md) để chạy và ghi bằng chứng trước khi tạo tag nộp.
