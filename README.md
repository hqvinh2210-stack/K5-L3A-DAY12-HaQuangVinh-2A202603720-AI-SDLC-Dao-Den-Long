# Đảo Đèn Lồng

**Đêm 1 – Đảo Bến** là trò chơi 3D trên trình duyệt. Sương đen đã nuốt mất ánh sáng của đảo. Hãy giúp Mây nhặt đom đóm, thắp năm Đèn Lồng Lớn và tìm chỗ trú khi Bóng Mực đến gần.

## Cài đặt và chơi

Cần Node.js 20 trở lên, npm và trình duyệt hỗ trợ WebGL. Trên macOS, Linux hoặc Windows, chạy từ thư mục dự án:

```sh
npm ci
npm start
```

Mở [trò chơi trên máy của bạn](http://127.0.0.1:4173/) và chọn **Bắt đầu chơi**.

## Điều khiển

| Phím | Hành động |
| --- | --- |
| W, A, S, D hoặc phím mũi tên | Di chuyển theo góc nhìn |
| Q / R | Xoay góc nhìn |
| Phím cách | Nhảy |
| E | Gửi đom đóm vào Đèn Lồng Lớn chưa sáng gần nhất |
| F | Tỏa sáng để đẩy lùi và làm choáng Bóng Mực |

Đi qua đốm vàng để tự nhặt đom đóm. Túi chứa tối đa 10 con. Mỗi đèn cần 5 con và có thể nhận qua nhiều lần gửi. Đèn đã thắp tạo vùng an toàn 4 m. Tỏa sáng tốn 2 con và hồi sau 2 giây. Mây thắng khi thắp đủ năm đèn, hoặc thua khi hết ngọn lửa hay bình minh đến trước khi thắp đủ đèn. Chọn **Chơi lại** sau khi kết thúc.

## Tính điểm

| Hành động | Điểm |
| --- | ---: |
| Nhặt một đom đóm mới | 10 |
| Thắp một Đèn Lồng Lớn | 100 |
| Làm choáng một Bóng Mực | 20 |
| Mỗi giây nguyên còn lại khi thắng | 2 |
| Mỗi ngọn lửa còn lại khi thắng | 50 |

Khi bị chạm, Mây mất một ngọn lửa và làm rơi một nửa số đom đóm đang mang, làm tròn xuống.

## Chế độ không giao diện

[game.contract.json](game.contract.json) là nguồn thông số chung của trình duyệt và CLI. Thay giá trị `team` bằng MSSV và họ tên theo mẫu `mssv-ho-ten` trước khi nộp. `fall_enabled` là `false` vì mép đảo là ranh giới mềm, Mây không rơi. Không có thông số `null` trong Phase 1. Mọi bán kính tương tác đo trên mặt phẳng XZ, kể cả khi Mây đang nhảy.

```sh
npm test
node src/headless.mjs --seed 1201 --night 1 --ticks 18000 --out ket-qua.jsonl
```

Thêm `--scenario <tệp.json>` để đặt trạng thái ban đầu, `--inputs <tệp.json>` để phát lại thao tác và `--snapshot-every <số>` để đổi khoảng cách giữa các bản ghi trạng thái (mặc định 10 tick). Xem [bằng chứng Phase 1](docs/proof/phase-1/README.md) để phát lại một ván thắng trên bản đồ mặc định.

## Sáng tạo của tôi

Đom đóm tạo một vòng xoắn nhỏ quanh Đèn Lồng Lớn vừa sáng. Hiệu ứng nằm trong bộ vẽ WebGL, còn [log kiểm thử](docs/proof/phase-1/contract-tests.log) ghi các ca kiểm tra hành vi gốc và so sánh đầu ra JSONL từng byte.

[Ghi chú về giả định](docs/notes/assumptions.md) · [Nhật ký dùng AI](docs/notes/ai-log.md) · [Retrospective](docs/notes/retro.md)
