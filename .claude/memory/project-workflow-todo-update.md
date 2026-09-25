---
name: project-workflow-todo-update
description: Quy trình bắt buộc cập nhật PROJECT_TODO.md sau khi PR merged
metadata:
  type: project
---

# Quy trình cập nhật PROJECT_TODO.md sau Merge

## Khi nào cần cập nhật

**Sau khi PR được merged vào `master`**, Agent phải tạo commit riêng để cập nhật `PROJECT_TODO.md`.

## Các bước thực hiện

1. **Verify task đã merged:** Kiểm tra git log để xác nhận commit của task đã xuất hiện trên `master`.
2. **Cập nhật PROJECT_TODO.md:**
   - Tick `[x]` vào task đã hoàn thành.
   - Thêm emoji ✅ (ví dụ: `- [x] **#13 [BE] ...** ✅`).
   - Nếu task là phần 2 của task gộp (VD: `#13 & #15`), cập nhật cả 2.
3. **Tạo commit riêng:**
   ```bash
   git add PROJECT_TODO.md
   git commit -m "chore: cập nhật PROJECT_TODO.md - <mô_tả ngắn> #done
   
   - Tick done các task NB-xx, NB-xx (đã merge vào master)
   - <Mô tả trạng thái mới>
   - Cập nhật tổng số: X/Y tasks hoàn thành
   
   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
   ```
4. **Push lên master:** `git push origin master`

## Tại sao cần commit riêng

- Tránh conflict khi nhiều thành viên cập nhật cùng lúc.
- Jira sync workflow chỉ trigger khi có commit message chứa mã task `NB-xx`.
- Commit `chore` tách biệt giúp git log sạch, dễ đọc.

## Nguồn quy định

Cập nhật trong: `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `.github/copilot-instructions.md`
