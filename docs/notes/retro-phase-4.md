# Retro — Đảo Đèn Lồng qua bốn phase

## Kết quả đánh giá

| Phase | Mốc và bằng chứng | Bài học |
| --- | --- | --- |
| 1 | Commit `6382254`. 15 ca đạt, lượt phát lại Đảo Bến thắng với 1.812 điểm. | Việc kiểm thử qua CLI từ đầu cho phép tái hiện chính xác các lần nhặt, thắp và mất lửa mà không cần GPU. |
| 2 | Commit `98b9eb4`. 28 ca đạt, bản thường đo 58,8 FPS ở Đảo Bến tại 1280×720. Luồng ba đêm kiểm tra bằng kịch bản một đèn còn lại. | Cần ghi rõ phạm vi thử. Đi qua ba màn dựng sẵn chứng minh giao diện chuyển đêm, còn kết quả mặc định phải có lượt chơi riêng. |
| 3 | Commit `9ca5630`. 38 ca đạt, hai lượt Đảo Chuông 18.000 tick mất 3,188 và 2,749 giây. ADR 003 ghi luật mới. | Dầu nguyên theo tick ngăn sai số tích lũy và làm rõ điều kiện tại đúng 30 dầu. Cần rà lại các ca dựa vào luật thắng cũ. |
| 4 | 44 ca đạt. Benchmark cùng cảnh ở chế độ vsync tăng từ 3,95 lên 59,98 FPS. Khi tắt giới hạn, số đo cuối là 112,85 FPS, 1% thấp 46,70 FPS. Soak có 0 crash, RSS 47,93 → 53,88 MiB. | Số đo stress cho thấy tải tạo hình mỗi khung bộc lộ ở 200 Bóng Mực dù chơi thường có ít sinh vật. Tái sử dụng hình học và vẽ theo lô xử lý nút thắt rõ hơn chỉnh quy tắc trò chơi. |

Các số trên lấy từ [chỉ mục bằng chứng](../proof/README.md), [kết quả benchmark](../../bench.json) và [soak](../../soak.json).

## Làm việc với AI

Giữ một lõi mô phỏng dùng chung giúp AI sửa luật ở một nơi, rồi dùng kịch bản nhỏ để kiểm tra biên tick. Việc có lệnh chạy thật và đầu ra lưu theo phase hữu ích hơn kết luận bằng lời. `AGENTS.md` giữ vị trí các nguồn thông số và quy ước tiếng Việt. Skill `lantern-contract` nhắc cách kiểm thử RGB, benchmark, CLI và bằng chứng trước tag. Bộ kiểm thử và CI là phần tự động kiểm nghiệm hiệu quả nhất. Repo sử dụng GitHub Actions cho CI; không ghi nhận hook Git tùy biến được chạy.

AI đã chọn cách trình bày tiêu đề có phông gây tách dấu trong Phase 1. Ảnh chụp trình duyệt cho thấy lỗi và tiêu đề được chuyển sang phông hệ thống. Ở Phase 3, bản đầu loại trường dầu nguyên khỏi đối tượng rồi đọc lại trường đó để xuất snapshot. Các ca dầu mặc định và dầu theo tick nhận `null`, giúp khoanh đúng lỗi trước khi tag. Ở Phase 4, lượt benchmark đầu có 3,95 FPS dù bản chơi thường từng gần 60. Cùng một cảnh chạy lại sau khi đổi cách vẽ đã định lượng tác động.

## Nếu làm lại

Thiết lập cảnh stress và ca hiệu năng ngay ở Phase 1. Dùng một kịch bản trình duyệt có thể bật bằng công cụ QA từ đầu, đồng thời kiểm tra phát lại headless sau mỗi lần thay hợp đồng. Tách sớm phần lưu điểm và cài đặt khỏi mô phỏng. Giữ các kết quả của phase cũ ở đúng tag để phân biệt lỗi hồi quy với luật được thay có chủ đích.

Tiết kiệm token bằng cách giữ lại mô phỏng, dùng test nhỏ nhắm đúng biên, lưu log thay vì chép lại toàn bộ đầu ra, và tạo nội dung hình ảnh bằng hình học có sẵn. Số liệu dưới đây lấy từ nhật ký sử dụng cục bộ của phiên Codex khi hoàn tất đóng gói Phase 4.

- **Tổng token AI ghi nhận:** 49.715.823, gồm 49.549.320 token đầu vào và 166.503 token đầu ra. Trong đầu vào có 49.151.488 token đọc từ bộ nhớ đệm. Đây là số cộng dồn của phiên làm việc, bao gồm các lượt kiểm tra và chỉnh sửa xen giữa các phase, tính đến 16:56 ngày 20/11/2026 (UTC+07:00).
- **Chi phí AI:** Chưa xác định. Nhật ký phiên không có số tiền đã tính; cần bổ sung từ hóa đơn hoặc báo cáo thanh toán.
