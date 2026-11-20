# Giả định Phase 1

- Một lượt mặc định kéo dài 300 giây mô phỏng. Nhặt đom đóm, gửi vào đèn và tỏa sáng diễn ra trước khi Bóng Mực di chuyển và chạm Mây trong cùng tick. Thắp đủ đèn được ưu tiên khi cùng tick với bình minh. Nếu hết lửa cùng tick với bình minh, lý do thua là `no_flames`.
- E gửi tối đa số còn thiếu vào đèn chưa sáng gần nhất trong bán kính. Phải thả rồi nhấn lại E để gửi lần tiếp theo. Các hành động nhảy và tỏa sáng cũng nhận cạnh nhấn.
- Tỏa sáng chỉ xảy ra khi đủ ánh sáng và hết hồi chiêu. Tỏa sáng vẫn tốn 2 đom đóm khi không có Bóng Mực trong tầm. Bóng Mực có thể tiếp tục đuổi sau 3 giây choáng, nhưng vùng an toàn của đèn đã sáng vẫn chặn cả bước đi lẫn lực đẩy. Bóng Mực nằm sẵn trong vùng sẽ bị đẩy ra ở bước mô phỏng kế tiếp.
- Mây nhảy với vận tốc ban đầu 6,1 m/s, gia tốc rơi 17 m/s² và hạ xuống ở Y = 0. Bán kính va chạm và tương tác đo theo XZ. Mép đảo chặn di chuyển ra ngoài, không gây mất lửa.
- Khi bị chạm, Mây rơi `floor(carried × hit_drop_ratio)` đom đóm. Đom đóm rơi có thể nhặt lại sau thời gian miễn nhiễm và vẫn tính điểm theo sự kiện nhặt.
- Bản đồ mặc định có 48 đom đóm lúc đầu và tạo thêm một con mỗi 5 giây nếu số đang có thấp hơn 48. Một đợt Bóng Mực bổ sung đến mỗi 36 giây, tối đa 7 con. Danh sách đom đóm hoặc Bóng Mực trong kịch bản thay thế danh sách lúc khởi tạo. `random_motes: false` và `random_shades: false` tắt phần sinh tự động tương ứng. Danh sách `motes` viết tay cũng tắt bù đom đóm để kịch bản giữ nguồn sáng đã định.
- Điểm thưởng khi thắng dùng số giây nguyên còn lại, làm tròn xuống. Trạng thái dựng sẵn (ví dụ đèn đã sáng) không tự sinh điểm hay sự kiện.
- Bản chơi trình duyệt dùng seed 1201 cho Đảo Bến. Phần mở đầu cho thấy trước một đèn sáng để minh họa mục tiêu, còn khi bắt đầu thì cả năm đèn đều tắt.
