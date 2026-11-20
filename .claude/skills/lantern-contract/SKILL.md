---
name: lantern-contract
description: Kiểm chứng cơ chế, bản đồ và bản nộp Đảo Đèn Lồng theo Test Contract v1.2, đặc biệt là dầu, vùng trú và kết quả bình minh.
---

- Đọc [ADR dầu và bình minh](../../../docs/adr/003-den-can-dau.md) rồi đối chiếu `game.contract.json` với thứ tự trong `src/sim.mjs`.
- Ưu tiên kịch bản sát biên tick: trừ dầu trước khi di chuyển, châm dầu trước khi tính vùng trú, hết Ngọn Lửa trước xét điểm bình minh. Kiểm tra mức dầu bằng đơn vị 1/60 ở lõi vì dầu trên snapshot chỉ có một chữ số thập phân.
- Chạy `npm test`. Chạy lại cùng seed, kịch bản và đầu vào ở hai tiến trình CLI, so theo byte và đo một đêm đủ 18.000 tick. Ghi lý do khi sửa hoặc bỏ ca của hợp đồng cũ.
- Nếu có thay đổi đồ họa hoặc HUD, kiểm tra bản `npm start` và ghi rõ các thao tác thực hiện. Phân biệt kịch bản dựng sẵn và lượt chơi mặc định. Lưu bằng chứng ở [chỉ mục](../../../docs/proof/README.md).
