# Giả định Phase 3

- Dầu nạp sẵn được lượng tử hóa tới đơn vị 1/60 gần nhất. Đèn đặt `lit: true` mặc định đầy dầu và thuộc nhóm từng sáng. `relit_count` chỉ đếm lần thắp lại trong mô phỏng của đêm đó.
- Điều kiện chọn đèn dùng trạng thái tại bước tương tác, sau khi đã trừ dầu. Đèn đầy ở snapshot đầu có thể nhận một đom đóm ở bước đầu nếu đã hao 1/60 dầu. Đèn vẫn đầy ở lúc tương tác bị bỏ qua hoàn toàn.
- Bóng Mực đi tới đèn yếu gần nhất, ưu tiên id nhỏ hơn khi bằng khoảng cách. Nếu không có đèn yếu, Bóng Mực đi về đèn tắt gần nhất. Nó chỉ chuyển sang hút dầu tại đèn đang sáng yếu. Phát hiện người chơi để đuổi giữ nguyên quy tắc khi Bóng Mực đang đi lang thang.
- Mỗi Bóng Mực phát một `fuel_drain` sau mỗi 60 tick thực sự hút liên tục, báo số dầu sau khi cộng dồn tất cả lượng hút trong bước đó. Khi rời trạng thái hút thì bộ đếm đặt lại. Tick tạm dừng không tính.
- Kiểm tra vùng trú và thưởng bình minh dùng dầu nguyên nội bộ. Snapshot có thể hiển thị 30,0 ngay dưới ngưỡng 30 do làm tròn. Tỏa Sáng tính mức thưởng theo trạng thái Bóng Mực đúng tại bước đánh trúng.
- Giữ nhãn tên phía trên nhân vật và nguồn nhạc nền tùy chọn từ bản làm việc. Tệp nhạc do người chơi chọn chỉ nằm trong phiên trình duyệt.
