# Nhật ký dùng AI

| Ngày | Công cụ | Công việc |
| --- | --- | --- |
| 2026-11-20 | Codex | Phân tích đề bài, dựng khung LAB12 và quy tắc làm việc trong `AGENTS.md`. |
| 2026-11-20 | Codex | Viết mô phỏng, CLI và các ca kiểm thử, bao gồm so sánh hai luồng JSONL theo byte. |
| 2026-11-20 | Codex | Dựng hình học WebGL, HUD, bản đồ và hiệu ứng. Chạy lệnh cài đặt, mở bản chơi trong trình duyệt và phát lại một ván thắng trên bản đồ mặc định. |

## Harness

`AGENTS.md` chứa quy ước của repo. Các ca chạy qua CLI để giảm lệ thuộc vào nội bộ mô phỏng. Trình duyệt dùng chính mô phỏng đó và không đổi luật chơi khi thêm hiệu ứng. Repo không cần hook cài riêng.

## Phase 2

Codex đối chiếu số chuẩn, chuyển mô phỏng và CLI sang v1.1, viết ca kiểm thử mới rồi dựng tiếp giao diện WebGL. Các lệnh headless được chạy thật để lấy log, số tick và kết quả lặp. Kiểm tra giao diện dùng bản mặc định để đo FPS và một máy chủ QA tạm để xác minh màn chuyển đêm.
