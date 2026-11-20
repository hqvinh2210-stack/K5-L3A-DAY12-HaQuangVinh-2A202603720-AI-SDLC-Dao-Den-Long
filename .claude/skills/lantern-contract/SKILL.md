---
name: lantern-contract
description: Kiểm chứng thay đổi cơ chế, bản đồ hoặc bản nộp của Đảo Đèn Lồng theo Test Contract và bằng chứng Phase 2.
---

- Đối chiếu `game.contract.json`, `src/maps.mjs` và thứ tự xử lý trong `src/sim.mjs`. Kiểm tra cả mốc trước và sau mỗi biên tick khi thay đổi hồi chiêu, sinh vật phẩm, tạm dừng hoặc hồi sinh.
- Với thay đổi hành vi, thêm ca vào `tests/contract.test.mjs` qua CLI và chạy `npm test`. Dùng cùng seed, kịch bản và đầu vào ở hai tiến trình riêng để đối chiếu từng byte.
- Với thay đổi hình ảnh hoặc HUD, mở bản `npm start` ở độ phân giải mục tiêu. Khi kiểm tra hiệu năng, ghi cỡ khung mà trình duyệt báo, cửa sổ lấy mẫu và FPS từ vòng vẽ. Nếu dùng kịch bản dựng sẵn để thử giao diện, ghi rõ trong bằng chứng.
- Lưu lệnh và kết quả thực đo theo [chỉ mục bằng chứng](../../../docs/proof/README.md), rồi đối chiếu [tiêu chí Phase 2](../../../docs/phase-2.md).
