# Bằng chứng Phase 2

## Tự động

Chạy `npm ci` rồi `npm test`. [Log thực chạy](contract-tests.log) và [mã kiểm thử](../../../tests/contract.test.mjs) bao gồm hồi quy Đảo Bến, các tính năng v1.1 và so sánh JSONL từng byte.

```sh
node src/headless.mjs --seed 1201 --night 1 --ticks 18000 --inputs docs/proof/phase-2/default-win.inputs.json --out dao-ben.jsonl
node src/headless.mjs --seed 1201 --night 3 --ticks 21600 --out dao-chuong.jsonl
```

Lượt phát lại Đảo Bến dùng bản đồ mặc định, không đặt trước đèn sáng. Lệnh Đảo Chuông chạy đủ 21.600 tick trong 4,332 giây và 8,505 giây ở hai lượt; so sánh nhị phân không thấy khác biệt. Xem [kết quả và thời gian thực đo](headless-runs.log).

## Trình duyệt

1. Chạy `npm start`. Mở menu chính, chọn **Bắt đầu chơi**. Kiểm tra tên đảo và lời Ông Đăng trước khi chọn **Vào đêm**.
2. Nhấn P hoặc Esc. Kiểm tra bốn lựa chọn tạm dừng. Đổi âm lượng và độ nhạy trong **Cài đặt**, tải lại trang rồi kiểm tra hai giá trị. Quan sát thấy Âm lượng 59% và Độ nhạy chuột 101% vẫn được giữ.
3. Đọc `document.body.dataset.fps` và `document.body.dataset.measuredViewport` sau khi chơi ít nhất năm giây. Bản thường đo **58,8 FPS** tại viewport **1280×720** trong cửa sổ năm giây ở Đảo Bến, trên Windows và trình duyệt tích hợp Codex.
4. Kiểm tra đường nạp đèn và chuyển đêm bằng kịch bản tạm có 10 đom đóm đang mang, một đèn chưa sáng cạnh Mây và các đèn khác đã sáng. Nhấn E mỗi đêm, đi qua hai nút **Sang đêm tiếp theo**, rồi kiểm tra kết quả. Trình duyệt hiển thị **Bình Minh**, **7 / 7** đèn ở Đảo Chuông và **3.024** tổng điểm. Kịch bản tạm chỉ dùng để kiểm tra UI và không nằm trong bản chơi.
5. Đối chiếu [tiêu chí nghiệm thu](../../phase-2.md) cho các thao tác âm thanh và HUD. Chưa đo FPS ở hai đảo còn lại, chưa nghe xác nhận từng hiệu ứng âm thanh và chưa chơi hết Đảo Cau hoặc Đảo Chuông từ trạng thái mặc định.
