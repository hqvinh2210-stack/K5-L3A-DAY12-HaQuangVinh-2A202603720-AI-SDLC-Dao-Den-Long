# ADR 003 — Đèn cạn dầu và thắng lúc bình minh

**Trạng thái** Đã chấp nhận cho Test Contract v1.2.

## Bối cảnh

Khi thắp đủ đèn là thắng ngay, người chơi có thể bỏ qua phần cuối của đêm. TICKET-03 yêu cầu giữ đủ đèn sáng đến bình minh và cho Bóng Mực can thiệp vào các đèn sắp cạn.

## Quyết định

- Mỗi đèn giữ số dầu nguyên theo đơn vị 1/60, tiến độ nạp, cờ từng sáng và số lần thắp lại. Bước 2 trừ dầu tự hao cùng lượng hút của các Bóng Mực đã ở trạng thái hút. Đèn hết dầu tắt ngay và mất tiến độ nạp. Đèn từng sáng cần 5 đom đóm để thắp lại, đèn mới cần 10.
- Vùng trú hoạt động từ đúng 30 dầu trở lên. Bước nạp có thể khôi phục vùng trú trong cùng tick và đẩy Bóng Mực ra. Bóng Mực đang hút gắn với một đèn, mất mục tiêu khi đèn tắt, được nạp đủ hoặc nằm ngoài tầm.
- Chỉ xét thắng ở bình minh, sau toàn bộ cập nhật của tick cuối. Hết Ngọn Lửa luôn được xét trước. Cần tối thiểu 3/5, 4/6 và 5/7 đèn còn sáng. Chỉ lượt thắng mới nhận điểm thưởng theo dầu và Ngọn Lửa còn lại.

## Hệ quả

Giao diện phải biểu thị dầu và ngưỡng đèn cần giữ. Kịch bản được phép đặt trạng thái đèn mà không phát sinh điểm hoặc tăng sức chứa. Đầu ra v1.2 làm tròn dầu tới một chữ số thập phân, còn so sánh ngưỡng và chấm điểm dùng số nguyên nội bộ.
