# Chạy Đảo Đèn Lồng v1.0.0

Giải nén bản web và mở terminal trong thư mục `dao-den-long-v1.0.0`. Cài sẵn Node.js 20 trở lên và dùng trình duyệt có WebGL.

```sh
node src/serve.mjs
```

Mở [Đảo Đèn Lồng](http://127.0.0.1:4173/). Dùng W A S D hoặc phím mũi tên để đi, Phím cách để nhảy, Shift để Lướt, E để nạp và F để Tỏa Sáng. Để đổi phím, chọn **Cài đặt → Đổi phím điều khiển**.

Xem bảng điểm từ menu chính. Để xuất cùng bảng điểm ra JSON, chạy `node src/serve.mjs --export-leaderboard diem.json`. Bản web cũng có thể chạy từ máy chủ tĩnh tại gốc URL. Khi đó bảng điểm nằm trong trình duyệt của địa chỉ đó, còn lệnh xuất JSON đọc bảng điểm của launcher Node.
