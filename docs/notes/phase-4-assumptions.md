# Giả định Phase 4

- Benchmark lấy một góc xoay từ PRNG cho mỗi tập điểm. Các điểm theo xoắn góc vàng, bán kính căn bậc hai tới dưới 38 m. X và Z theo cùng quy ước góc với bản đồ. Bóng Mực giữ `wander`, vẫn chọn mục tiêu và bị vùng trú chặn theo luật đi lang thang. Cảnh tắt phát hiện Mây, hao dầu, sát thương, nhặt, sinh thêm và kết thúc. Hiệu ứng xoắn trang trí tắt, ánh sáng WebGL và quầng đom đóm chuẩn còn hoạt động.
- Đo từ sau 3 giây làm nóng đến mốc kết thúc. Bao gồm khoảng giữa hai callback khung hình khi cả hai mốc nằm trong cửa sổ đo. Làm tròn số tải tính theo ms sau lần vẽ đầu tiên. Giá trị FPS giữ độ chính xác tính toán.
- Soak chạy ngay đêm tiếp theo sau khi đêm hiện tại kết thúc. Đêm i dùng seed 7+i với i từ 1 đến 10. Mỗi mốc 30 tick rút một góc đều từ PRNG riêng của input, rồi mỗi tick rút theo thứ tự nhảy, Lướt, Tỏa Sáng, nạp. Chụp RSS sau GC tại hai mốc của cùng tiến trình và theo cùng cách trên mọi hệ điều hành.
- Khi hòa điểm, so thời điểm tuyệt đối có độ lệch múi giờ. Nếu thời điểm cũng trùng thì giữ thứ tự thêm nhờ phép sắp xếp ổn định. Lượt thua ngay ở Đêm 1 có thể lưu 0 điểm và 0 đêm. Tên nhân vật tùy ý trong menu khác tên ghi chính thức trên bảng điểm.
- Cài đặt phím giữ mũi tên, Shift phải và P làm phím phụ khi phím chính tương ứng chưa đổi. Phím xoay Q/R và Tab được giữ cho điều hướng.
