---
name: lantern-contract
description: Kiểm chứng thay đổi gameplay, hiệu năng WebGL và bản nộp Đảo Đèn Lồng theo Test Contract v1.3.
---

- Đối chiếu `src/sim.mjs` với `game.contract.json` và [ADR dầu và bình minh](../../../docs/adr/003-den-can-dau.md) khi thay đổi cơ chế. Kiểm tra cả hai phía của các ngưỡng và tick cuối.
- Chạy `npm test`. So JSONL từng byte giữa hai tiến trình và với tag gần nhất khi luật giữ nguyên. Xác nhận đầu ra kết thúc và thời gian của một đêm đầy đủ.
- Đo đúng cửa sổ Chromium 1280×720 bằng lệnh benchmark trong README, chờ đủ thời gian làm nóng và đo. Ghi renderer, OS và vsync. Dùng kết quả thật của soak để xác nhận RSS sau thu gom.
- Khi chuẩn bị tag, thử cài ở bản clone sạch và mở gói web đã giải nén. Lưu [bằng chứng](../../../docs/proof/README.md) rồi đối chiếu [bước phát hành](../../../docs/release/README.md) với những gì người nộp thực hiện.
