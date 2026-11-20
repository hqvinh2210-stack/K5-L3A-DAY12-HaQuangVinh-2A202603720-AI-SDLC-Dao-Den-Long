# Nhật ký thay đổi

## Phase 3 — Đèn cạn dầu

- Thay luật thắng ngay `all_lit` bằng `dawn_survived` khi đủ 3/5, 4/6 hoặc 5/7 đèn ở tick bình minh. Thời hạn đổi thành 240, 270 và 300 giây.
- Đèn nhận dầu khi đang sáng, có thể tắt và thắp lại bằng 5 đom đóm. Vùng trú chỉ hoạt động từ 30 dầu; Bóng Mực có trạng thái `drain`.
- Thay công thức điểm. Bỏ thưởng thời gian, thêm điểm thắp lại, châm dầu, đánh trúng Bóng Mực đang hút và thưởng theo lượng dầu lúc thắng.
- Test Contract v1.2 thêm dầu, lịch sử đèn, sức chứa và các sự kiện `refuel`, `lantern_out`, `fuel_drain`. Sự kiện `lantern_lit` thêm cờ `relight`.
- Giao diện thêm thanh dầu, nhấp nháy khi yếu, bảng màu dễ phân biệt, tên trên đầu Mây và tùy chọn nhạc nền cục bộ.

## Phase 2 — Ba hòn đảo

- Chuẩn hóa điều khiển và bản đồ Đảo Bến theo Test Contract v1.1.
- Thêm Đảo Cau, Đảo Chuông, Lướt, bệ nhảy, Gió Lạc, Bùa Gió, gió mạnh và hồi sinh.
- Thêm luồng ba đêm, Bình Minh, tạm dừng, cài đặt và âm thanh.

## Phase 1 — Đêm 1, Đảo Bến

- Thêm một màn chơi WebGL 3D với Mây, đom đóm, năm Đèn Lồng Lớn, Bóng Mực và bản đồ nhỏ.
- Thêm điểm, trạng thái thắng/thua, tỏa sáng, vùng an toàn và chơi lại.
- Thêm mô phỏng định thời 60 tick/giây, CLI Test Contract v1.0 và bằng chứng kiểm thử.
