---
name: task-isolation-rule
description: Mỗi task commit riêng, không gộp chung nhiều task
metadata:
  type: feedback
---

## Quy tắc: Commit từng task riêng biệt

**Rule:** Xong task nào commit task đó, không gộp chung nhiều task vào một commit.

**Why:** User muốn mỗi commit map 1-1 với Jira task để dễ theo dõi tiến độ và revert nếu cần.

**How to apply:**
- Mỗi task tạo branch riêng: `feat/NB-<id>-<short-desc>-truong`
- Mỗi task commit riêng: 1 commit = 1 task
- Sau khi xong, push và tạo PR riêng cho task đó
- KHÔNG gộp nhiều task (NB-36 + NB-38 + NB-40) chung 1 commit hay 1 PR
- Cập nhật PROJECT_TODO.md ngay sau khi commit
