# Bằng chứng Phase 3 — Đèn cạn dầu

## Kiểm thử tự động

Chạy `npm ci` rồi `npm test`. Xem [log kiểm thử](contract-tests.log) và [mã nguồn các ca](../../../tests/contract.test.mjs). Bộ kiểm thử dùng CLI thật cho dầu, châm dầu, thắp lại, Bóng Mực hút dầu, sức chứa, ngưỡng vùng trú, thứ tự bình minh và các luật trước đó. Ca đèn đầy cô lập bước tương tác bằng cách đặt tốc độ hao bằng 0 trong bộ test. Bản thường trừ dầu trước khi xét tương tác.

```sh
node src/headless.mjs --seed 1201 --night 3 --ticks 18000 --out a.jsonl
node src/headless.mjs --seed 1201 --night 3 --ticks 18000 --out b.jsonl
node src/headless.mjs --seed 1201 --night 1 --ticks 1680 --scenario docs/proof/phase-3/browser.scenario.json --inputs docs/proof/phase-3/browser.inputs.json --out dawn.jsonl
```

Xem [thời gian và so sánh từng byte](headless-runs.log). Lượt Đảo Chuông kiểm tra đủ 18.000 tick. Lượt Đảo Bến dùng kịch bản có một đèn yếu, rồi nạp năm đom đóm để giữ đủ ba đèn tới bình minh.

## Thay đổi ca hồi quy

- Ca thắng ngay khi thắp đèn cuối được đổi thành ca đủ đèn mà vẫn chơi tiếp, chờ đúng tick bình minh và thưởng điểm theo dầu.
- Ca phát lại bản đồ mặc định của Phase 2 được giữ làm bằng chứng lịch sử ở tag `phase-2`. Bỏ xác nhận kết quả `all_lit` và điểm của lượt phát lại đó khỏi Phase 3 vì luật thắng, thời hạn và hành vi Bóng Mực đã đổi.
- Ca Tỏa Sáng xác nhận Bóng Mực về `wander` khi hết choáng. Các ca liên quan dùng thêm trường `relight` và thời hạn Đảo Chuông 18.000 tick.

## Trình duyệt

Bản thường mở bằng `npm start`. Một máy chủ kiểm tra cục bộ dùng [kịch bản Đảo Bến](browser.scenario.json) để đặt ba đèn đang sáng và đồng hồ 28 giây. Đã bật **Bảng màu dễ phân biệt**, tải lại và xác nhận cài đặt còn được giữ. Trong ván kiểm tra, đồng hồ hiện **⚠ 0:28** màu trắng, Bóng Mực có viền và mắt xanh, đèn có thanh dầu, HUD hiện **3 / 5 · cần 3** và **5 / 14** trước khi châm. Nhấn E tiêu thụ năm đom đóm, tăng 25 điểm và đưa túi về **0 / 14**. Kịch bản này dùng để kiểm tra giao diện và không thay cho trạng thái mặc định khi chơi.

Khi đồng hồ về 0:00, màn **Vượt qua đêm tối!** hiển thị ba đèn còn sáng và 515 điểm.
