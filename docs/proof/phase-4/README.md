# Bằng chứng Phase 4

| Bài đo trên Windows, Intel UHD 620 | FPS trung bình | FPS 1% thấp | P95 (ms) | Tải (ms) |
| --- | ---: | ---: | ---: | ---: |
| Trước tối ưu, có vsync | 3,95 | 3,03 | 300,70 | 2.363 |
| Sau tối ưu, có vsync | 59,98 | 47,61 | 17,30 | 2.147 |
| Sau tối ưu, tắt vsync | 112,85 | 46,70 | 13,70 | 2.359 |

Bản trước tối ưu dùng renderer Phase 3 cộng camera và cảnh chuẩn. Sau tối ưu, cache lưới đèn và sprite quầng sáng, cắt đối tượng ngoài khung trước khi tải lên và vẽ Bóng Mực theo lô instanced. Các số trên là đo tham khảo ở máy phát triển. [Baseline](bench-baseline.json) · [Bản tối ưu có vsync](bench-optimized-vsync.json) · [Kết quả benchmark cuối](../../../bench.json)

```sh
node src/bench.mjs --seed 42 --duration 30 --out bench.json
node --expose-gc src/soak.mjs --seed 7 --nights 10 --out soak.json
npm test
```

- [Soak](../../../soak.json) chạy 10 đêm trong một tiến trình: 0 crash, RSS 47,93 → 53,88 MiB, tăng khoảng 12,4%.
- [Log npm test](tests.log) bao gồm ca hồi quy, công thức bench, schema, ngưỡng soak, API và xuất điểm sau khởi động lại, phím tắt và cài đặt.
- [Log đối chiếu headless](headless.log) ghi hai lần chạy đủ 18.000 tick giống byte và cùng kết quả ở tag Phase 3. Kịch bản bình minh cũng giống từng byte giữa hai phiên bản.
- [Ảnh cảnh chơi](gameplay.jpg) ghép hai canvas thật và giá trị HUD tại thời điểm ghi trong kịch bản QA. Trong trình duyệt, phím Nhảy báo trùng W; gán J giữ qua tải lại và khôi phục trả về Phím cách. Cỡ chữ đo 18 px ở bản thường và 22,5 px khi bật chữ lớn. Giảm chuyển động còn bật sau khi tải lại. Kịch bản thua cho phép lưu **Ánh_Sao** và thấy mục **0 điểm · 0/3 đêm** từ menu chính.
- [Log cài đặt sạch và gói web](clean-install.log) ghi các lệnh chạy ở checkout mới và sau khi giải nén gói. Các bài kiểm thử ẩn và máy chấm của giảng viên chưa được chạy.
