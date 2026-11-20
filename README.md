# Đảo Đèn Lồng

Ba hòn đảo nổi đã chìm trong sương. Cùng Mây tìm đom đóm và thắp lại Đèn Lồng Lớn trên **Đảo Bến**, **Đảo Cau** và **Đảo Chuông**.

## Chơi trên trình duyệt

Cần Node.js 20 trở lên, npm và trình duyệt có WebGL. Trên macOS, Linux hoặc Windows, chạy từ thư mục dự án:

```sh
npm ci
npm start
```

Mở [trò chơi](http://127.0.0.1:4173/) và chọn **Bắt đầu chơi**. Nếu PowerShell chặn tệp `npm.ps1`, dùng `npm.cmd` thay cho `npm`.

| Phím | Hành động |
| --- | --- |
| W, A, S, D hoặc phím mũi tên | Chạy theo góc nhìn |
| Q / R hoặc kéo chuột trên cảnh | Xoay góc nhìn |
| Phím cách | Nhảy |
| Shift | Lướt |
| E | Nạp ánh sáng vào đèn chưa sáng gần nhất |
| F | Tỏa Sáng |
| Esc / P | Tạm dừng hoặc tiếp tục |

Túi chứa 10 đom đóm. Mỗi đèn cần 10 con và giữ tiến độ giữa các lần nạp. Tỏa Sáng tốn 3 con. Một đèn sáng tạo vùng trú 6 m khỏi Bóng Mực. Gió Lạc có thể lấy đom đóm ngay trong vùng này. Bùa Gió giúp chạy nhanh và Lướt liên tiếp trong 10 giây. Nếu rơi khỏi đảo, Mây mất một Ngọn Lửa và toàn bộ đom đóm đang mang.

Thắp hết đèn để sang đêm kế tiếp. Ngọn Lửa được nạp đầy vào đầu mỗi đêm. Màn **Bình Minh** xuất hiện khi thắp đủ đèn Đảo Chuông. Âm lượng và độ nhạy chuột được lưu trong trình duyệt.

## Điểm

Mỗi đom đóm **đã nạp vào đèn** cộng 10 điểm, mỗi đèn sáng cộng 100 điểm và mỗi Bóng Mực trúng Tỏa Sáng cộng 5 điểm. Khi thắng một đêm, cộng thêm 2 điểm mỗi giây nguyên còn lại và 50 điểm mỗi Ngọn Lửa còn lại. Tổng điểm Bình Minh là tổng điểm của các đêm đã thắng.

## Test Contract v1.1

Thông số dùng chung nằm trong [game.contract.json](game.contract.json). Hãy thay `team: mssv-ho-ten` bằng MSSV và họ tên trước khi nộp. `fall_enabled` đang bật. Chế độ headless dùng cùng mô phỏng cố định 60 tick/giây với bản đồ họa.

```sh
npm test
node src/headless.mjs --seed 1201 --night 3 --ticks 21600 --out ket-qua.jsonl
```

`--night` nhận 1, 2 hoặc 3. Có thể thêm `--scenario <tệp.json>`, `--inputs <tệp.json>` và `--snapshot-every <số>`. Xem [bằng chứng Phase 2](docs/proof/phase-2/README.md), [tiêu chí nghiệm thu](docs/phase-2.md) và [giả định](docs/notes/phase-2-assumptions.md).

## Sáng tạo của tôi

Giữ vòng xoắn đom đóm quanh đèn đã thắp từ Phase 1. Phase 2 thêm bè trầm và thay tông nhạc theo từng đảo. Hai hiệu ứng chạy trong WebGL và Web Audio. [Log kiểm thử](docs/proof/phase-2/contract-tests.log) bao gồm so sánh đầu ra headless theo byte.
