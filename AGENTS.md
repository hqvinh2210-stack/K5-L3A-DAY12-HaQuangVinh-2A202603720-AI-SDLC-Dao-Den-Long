# Hướng dẫn làm việc với LAB12

- Giữ mô phỏng thuần định thời 60 tick/giây trong `src/sim.mjs`. WebGL chỉ đọc trạng thái, còn trình duyệt và CLI dùng chung thông số từ `game.contract.json`.
- Dùng `npm test` sau khi sửa hành vi. Các ca hợp đồng chạy qua CLI thật và kiểm tra cả thứ tự sự kiện, mã thoát và tính lặp lại của JSONL.
- Viết toàn bộ chữ người chơi thấy và README bằng tiếng Việt có dấu.
- Lưu giả định, nhật ký AI và retrospective trong `docs/notes/`. Lưu đầu ra thật và cách chạy lại trong `docs/proof/`.
- Cập nhật README khi thay đổi cách cài đặt, điều khiển, điểm hoặc thông số hợp đồng.
