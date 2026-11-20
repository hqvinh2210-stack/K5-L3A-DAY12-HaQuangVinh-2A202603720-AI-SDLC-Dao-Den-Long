# Hướng dẫn làm việc với LAB12

- `game.contract.json` là nguồn thông số dùng chung. `src/maps.mjs` chứa hình học và điểm sinh chuẩn của ba đêm. Bản đồ họa đọc cùng dữ liệu với headless.
- Xem thứ tự tick trong `src/sim.mjs` trước khi đổi hành vi. `tick` đếm cả thời gian tạm dừng, còn `sim_tick` đếm thời gian chơi. Kịch bản không sinh sự kiện ngay ở tick 0.
- Chạy `npm test` sau mỗi thay đổi luật. Giữ các ca hồi quy Đảo Bến và kiểm tra CLI thực tế với kịch bản xác định.
- Chỉ thêm nội dung mỹ thuật và nhạc vào client nếu tính năng nằm ngoài hợp đồng. Viết chữ người chơi thấy bằng tiếng Việt có dấu.
- Dùng [skill lantern-contract](.claude/skills/lantern-contract/SKILL.md) để lập bằng chứng trước khi đánh dấu một phase. Ghi giả định và nhật ký AI vào `docs/notes/`.
