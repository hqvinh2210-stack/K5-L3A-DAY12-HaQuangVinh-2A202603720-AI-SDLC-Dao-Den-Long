# Đảo Đèn Lồng

Ba hòn đảo nổi đã chìm trong sương. Cùng Mây nhặt đom đóm, châm dầu và giữ Đèn Lồng Lớn sáng tới bình minh trên **Đảo Bến**, **Đảo Cau** và **Đảo Chuông**.

## Chơi trên trình duyệt

Cần Node.js 20 trở lên, npm và trình duyệt có WebGL. Chạy từ thư mục dự án:

```sh
npm ci
npm start
```

Mở [trò chơi](http://127.0.0.1:4173/). Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd` thay cho `npm`.

| Phím | Hành động |
| --- | --- |
| W, A, S, D hoặc phím mũi tên | Chạy theo góc nhìn |
| Q / R hoặc kéo chuột trên cảnh | Xoay góc nhìn |
| Phím cách | Nhảy |
| Shift | Lướt |
| E | Nạp ánh sáng, thắp lại hoặc châm dầu cho đèn gần nhất có thể nhận |
| F | Tỏa Sáng, tốn 3 đom đóm |
| Esc / P | Tạm dừng hoặc tiếp tục |

Đảo Bến kéo dài 4 phút, Đảo Cau 4 phút 30 giây và Đảo Chuông 5 phút. Khi bình minh đến, Mây phải còn Ngọn Lửa và giữ ít nhất **3/5**, **4/6** hoặc **5/7** đèn sáng tương ứng. Thắp hết đèn sớm vẫn phải giữ chúng sáng tới cuối đêm.

Đèn mới cần 10 đom đóm, đèn từng sáng cần 5 để thắp lại. Đèn mất 1 dầu mỗi giây, còn mỗi Bóng Mực đang hút làm mất thêm 5 dầu mỗi giây. Mỗi đom đóm châm được 10 dầu, đến tối đa 100. Từ đúng 30 dầu, đèn có vùng trú 6 m khỏi Bóng Mực. Dưới 30, đèn nhấp nháy và vùng trú biến mất. Túi bắt đầu với 10 chỗ, tăng 2 mỗi lần thắp thành công và tối đa 20 chỗ.

Trong **Cài đặt**, bật **Bảng màu dễ phân biệt** để đổi viền và mắt Bóng Mực thành xanh lam, đồng thời dùng cảnh báo trắng có dấu ⚠. Đèn tắt thấp hơn và có giấy rách. Trình duyệt lưu tùy chọn bảng màu, âm lượng và độ nhạy chuột.

## Điểm

Mỗi đom đóm nạp hoặc châm cộng 5 điểm, thắp lần đầu cộng 100 và thắp lại cộng 40. Tỏa Sáng cộng 5 cho mỗi Bóng Mực trúng đòn, hoặc 15 nếu nó đang hút dầu. Khi thắng, mỗi đèn còn sáng cộng 50 cộng phần nguyên lượng dầu, và mỗi Ngọn Lửa còn lại cộng 50. Màn **Bình Minh** cộng điểm từ các đêm đã thắng.

## Test Contract v1.2

[game.contract.json](game.contract.json) dùng chung cho trình duyệt và CLI 60 tick/giây. Thay `mssv-ho-ten` trong trường `team` bằng MSSV và họ tên trước khi nộp. `score.per_second_left` là `null` vì điểm thưởng thời gian đã bị bỏ.

```sh
npm test
node src/headless.mjs --seed 1201 --night 3 --ticks 18000 --out ket-qua.jsonl
```

`--night` nhận 1, 2 hoặc 3. Có thể thêm `--scenario <tệp.json>`, `--inputs <tệp.json>` và `--snapshot-every <số>`. Xem [bằng chứng Phase 3](docs/proof/phase-3/README.md), [ADR](docs/adr/003-den-can-dau.md) và [giả định](docs/notes/phase-3-assumptions.md).

## Sáng tạo của tôi

Giữ vòng xoắn đom đóm quanh đèn, giảm độ sáng theo nhịp khi đèn yếu. Nhạc nền vẫn có bè trầm và đổi tông theo đảo. Tên đã lưu của người chơi xuất hiện trên đầu Mây và màn kết quả. Có thể chọn tệp **honeybee** của Olivia Rodrigo hoặc tệp âm thanh khác qua **Cài đặt → Nhạc nền**. Tệp phát cục bộ trong phiên hiện tại. Các hiệu ứng và tùy chọn này nằm ở client. [Log kiểm thử](docs/proof/phase-3/contract-tests.log) ghi đối chiếu đầu ra headless từng byte.
