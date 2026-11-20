# Giả định Phase 2

- `night_start` phát ở bước chơi đầu tiên. Nếu thao tác đầu là tạm dừng, nó phát lúc mô phỏng bắt đầu sau khi tiếp tục. `resumed` xuất hiện trước sự kiện của bước tiếp tục.
- Lướt giữ hướng và cao độ khi đang bay. Nếu Lướt giữa đường phóng từ bệ, vận tốc của bệ tiếp tục sau Lướt. Gió cộng vận tốc XZ sau vận tốc điều khiển. Hướng gió dùng PRNG gieo seed, lấy góc nguyên từ 0 đến 359°.
- Đảo Chuông giữ điểm xuất phát `(0,0,0)` trên tầng nền bên dưới đĩa cao. Có thể rời tầng nền theo phương ngang, đi lên tầng giữa bằng dốc hoặc lên đĩa cao bằng bệ. Tương tác đèn giữ phép đo XZ từ v1.0. Bóng Mực bám mặt nền có thể đi tới; ở mép ngoài nó dừng thay vì rơi.
- Bóng Mực mặc định sinh ở tick 300 trên cả ba đêm rồi theo chu kỳ của đảo. Điểm hợp lệ cách Mây ít nhất 15 m, ngoài vùng đèn sáng và không bị Bóng Mực khác chiếm. Ngoài vùng phát hiện, nó đi tiếp tuyến quanh đảo. Tỏa Sáng ghi đè giật lùi, đợt đẩy dừng khi chạm biên an toàn hoặc tường.
- Gió Lạc chọn một điểm sương từ vành điểm sinh của đảo, nhấc cao thêm 0,55 m. Điểm sinh và hướng lượn đều theo seed. Đom đóm rơi sống 480 tick, dùng điểm đất ngay dưới chỗ mất. Đom đóm rơi do mất Ngọn Lửa đặt trên vành 2 m. Giới hạn 30 dùng để xét lượt sinh theo lịch, đom đóm bị rơi vẫn được tạo đủ số.
- Bước thua do rơi trả `dropped: 0` và `lost` là số đom đóm mất. `invuln` là cờ boolean. `ttl_s: null` chỉ đom đóm không có hạn sống. `wind.dir_deg` là `null` trước đợt gió đầu, sau đó giữ góc gần nhất khi gió tắt.
- Lấy điểm của các đêm thắng khi chuyển màn. Chơi lại một đêm không cộng điểm của lần thua trước đó.
