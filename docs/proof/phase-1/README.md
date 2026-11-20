# Bằng chứng Phase 1

## Hợp đồng v1.0

Chạy `npm ci` rồi `npm test`. Xem [đầu ra thật của bộ kiểm thử](contract-tests.log) và [mã ca kiểm thử](../../../tests/contract.test.mjs). Các ca bao phủ mô hình tick, tốc độ, hướng camera, chuẩn hóa đường chéo, nhảy, bán kính nhặt, sức chứa, gửi từng phần, tỏa sáng, va chạm và miễn nhiễm, vùng an toàn, ba kết cục, khởi tạo kịch bản và mã thoát. Ca lặp chạy CLI hai lần và so hai bộ đệm JSONL bằng `Buffer.compare`.

## Phát lại một ván thắng

Đây là chuỗi thao tác cho bản đồ mặc định, không dùng tệp kịch bản, seed 1201 giống bản chơi đồ họa.

```sh
node src/headless.mjs --seed 1201 --night 1 --inputs docs/proof/phase-1/default-win.inputs.json --ticks 18000 --out default-win.jsonl --snapshot-every 600
```

[Đầu ra kết thúc thật](default-win.end.json) ghi ván thắng ở tick 4084 với 1.812 điểm. Hai lần chạy lệnh trên cho cùng [SHA-256](default-win.sha256). Bộ kiểm thử cũng chạy lại tuyến đường và xác nhận năm sự kiện thắp đèn, lý do `all_lit`, tick cuối và điểm.

## Trình duyệt

Chạy `npm start` trên Windows và trình duyệt tích hợp Codex nhận HTTP 200. Đã quan sát [cảnh mở đầu WebGL](browser-intro.jpg), thử di chuyển, nhảy và xoay camera, rồi xác nhận màn thua khi hết lửa. Nút **Chơi lại** đưa HUD về 3 ngọn lửa, 0 đèn sáng và 0 điểm.

Lượt ghi dùng đồng hồ kiểm thử để gửi lại các phím của tuyến đường trên vào client WebGL và chạy nhanh hơn thời gian thật. [Khung hình thắng](browser-win.jpg) ghi 5/5 đèn và 1.812 điểm. Đã thử nút **Chơi lại** sau khi thắng và thấy HUD trở về trạng thái ban đầu. Xem [video MP4](../../demo/demo.mp4).
