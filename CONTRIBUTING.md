# SỔ TAY QUY TRÌNH PHÁT TRIỂN & PHỐI HỢP DỰ ÁN (CONTRIBUTING GUIDE)
> **Dự án:** NutriBot - Hệ thống Tư vấn Dinh dưỡng Cá nhân hóa (SWP391 - Nhóm 7)  
> **Repository:** [https://github.com/tg20th/swp391-group7-nutribot](https://github.com/tg20th/swp391-group7-nutribot)  
> **Jira Workspace:** [https://danyngo06.atlassian.net](https://danyngo06.atlassian.net) (Project Key: **`NB`**)

Tài liệu này quy định toàn bộ quy trình làm việc chuẩn Agile/Scrum và DevOps dành cho cả 4 thành viên (Trường, Thắng, Lan, Khánh) cũng như các AI Coding Agent (Antigravity, Claude Code trên IntelliJ, Cursor).

---

## 👥 1. BẢNG PHÂN CÔNG VAI TRÒ & TRÁCH NHIỆM

| Thành viên | Vai trò | Email Atlassian / GitHub | Phạm vi phụ trách chính |
| :--- | :---: | :--- | :--- |
| **Nhật Trường Ngô** | Backend Lead | `ngonhattruong555@gmail.com` | Xác thực (Auth), Bảo mật (JWT, Spring Security 6), Phân quyền Role, Blog & Video API, Bình luận & Thả tim, Admin APIs. |
| **Thắng Lê Nguyễn Minh** | Backend Dev | `minhthangphuocbuu@gmail.com` | Hồ sơ cá nhân (UserProfile), Chỉ số sức khỏe & Dị ứng, Thuật toán BMI, Danh mục (Category), Thực đơn tuần, Nhà hàng GPS, Java AI Gateway. |
| **Tuyết Lan** | AI & Frontend | `tuyetlanlt21@gmail.com` | Python AI Microservice (FastAPI, Prompt Engineering NutriBot, Meal Planner) + React UI Đăng ký/Đăng nhập, Profile, Chatbot NutriBot, Lập thực đơn. |
| **Minh Khánh** | BA & Frontend | `luongminhkhanh20@gmail.com` | Quản trị yêu cầu, Tài liệu đặc tả + React UI Admin Dashboard (4 màn hình quản trị), Giao diện Blog/Video, Bình luận/Vote, Bản đồ Nhà hàng GPS. |

---

## 🏃 2. LỘ TRÌNH 3 SPRINT (MỖI SPRINT 1 TUẦN)

Toàn bộ 59 công việc được chi tiết hóa trong file [`PROJECT_TODO.md`](PROJECT_TODO.md):
- **Sprint 1 (Tuần 1 - Thứ 2 đến CN) [Tasks #1 - #32]:**
  - Xây dựng hạ tầng Backend Spring Boot, Database schema MySQL, xác thực JWT.
  - Quản lý nội dung bài viết sức khỏe (Blog/Video).
  - Khởi tạo Python FastAPI và dựng Chatbot NutriBot MVP kết nối Gemini LLM.
  - Xây dựng giao diện React cho Authentication & Khung điều hướng.
- **Sprint 2 (Tuần 2 - Thứ 2 đến CN) [Tasks #33 - #48]:**
  - Quản lý hồ sơ sức khỏe cá nhân, tính toán BMI và dị ứng món ăn.
  - Tính năng AI gợi ý thực đơn tuần cá nhân hóa (Meal Planning).
  - Tương tác cộng đồng: Bình luận bài viết và thả tim (Like/Vote).
- **Sprint 3 (Tuần 3 - Thứ 2 đến CN) [Tasks #49 - #59]:**
  - Tích hợp tìm kiếm địa điểm ăn uống lành mạnh và bản đồ định vị GPS.
  - Xây dựng Admin Dashboard quản trị người dùng, nội dung và duyệt bài viết.
  - Hoàn thiện Docker compose, tối ưu hiệu năng và kiểm thử toàn diện.

---

## 🌿 3. QUY TRÌNH GIT FLOW & SMART COMMITS

### 3.1. Tạo Nhánh tính năng (Branching)
Không bao giờ code trực tiếp trên nhánh `master`. Luôn tạo nhánh mới từ `master` theo cú pháp:
```bash
git checkout master
git pull origin master
git checkout -b feat/NB-<mã_task>-<tên_ngắn>-<tên_bạn>
```
*Ví dụ:*
- `feat/NB-02-register-truong`
- `feat/NB-10-bmi-thang`
- `feat/NB-32-fastapi-lan`
- `feat/NB-16-blog-ui-khanh`

> **QUY TẮC BẮT BUỘC: 1 TASK = 1 BRANCH = 1 COMMIT = 1 PR**
> - Mỗi task Jira phải có **đúng 1 branch riêng**, **đúng 1 commit**, và **đúng 1 PR**.
> - Không gộp nhiều task vào chung 1 commit hay 1 PR.
> - Commit xong task nào → push và tạo PR cho task đó ngay, không chờ.
> - **Sau khi PR được merged vào `master`:** Tạo commit riêng `chore: cập nhật PROJECT_TODO.md - <mô_tả>` cập nhật `[x]` tick done rồi push lên `master`.

### 3.2. Cú pháp Commit chuẩn 100% Tiếng Việt (Git 50/72 Rule)
Mỗi commit bắt buộc phải gắn mã task `NB-xx` để tự động liên kết với Jira:

```text
<loại>(NB-<mã_task>-<TẦNG>): <Tiêu đề ngắn 50 - 72 ký tự tiếng Việt> [#done]

- <Gạch đầu dòng 1: Chi tiết file/tính năng đã tạo hoặc chỉnh sửa>
- <Gạch đầu dòng 2: Xử lý logic nghiệp vụ hoặc bảo mật>
- <Gạch đầu dòng 3: Kết quả test>
```

- `<loại>`: `feat` (tính năng mới), `fix` (sửa lỗi), `test` (kiểm thử), `refactor` (tối ưu).
- `<TẦNG>`: `BE` (Backend), `FE` (Frontend), hoặc `AI` (AI Service).
- **Jira Smart Commits:**
  - Thêm `#done` ở cuối tiêu đề nếu commit này hoàn thành task ➡️ Thẻ task trên Jira sẽ **tự động chuyển sang cột Done**.
  - Thêm `#time 2h` nếu muốn tự động ghi nhận thời gian làm việc vào Jira.

*Ví dụ commit hoàn chỉnh:*
```bash
git commit -m "feat(NB-02-BE): hoàn thành API đăng ký và mã hóa mật khẩu #done

- Tạo AuthController với endpoint POST /api/v1/auth/register
- Mã hóa mật khẩu người dùng bằng BCryptPasswordEncoder
- Bổ sung kiểm tra trùng lặp email và username trong DB
- Chạy unit test AuthControllerTest đạt 100%

Closes NB-2"
```

---

## 🤖 4. HỆ THỐNG TỰ ĐỘNG HÓA CI/CD & BOT REVIEW

Dự án tích hợp sẵn bot hệ thống **`github-actions[bot]`** trong thư mục [`.github/workflows/`](.github/workflows):

1. **`ci.yml` (CI Gatekeeper):**
   - Tự động chạy mỗi khi có Pull Request mở vào nhánh `master`.
   - Kiểm tra độc lập cả 3 tầng: Chạy `mvn test` (Java 25 Spring Boot), kiểm tra build React Vite, kiểm tra cú pháp Python.
2. **`ai-pr-reviewer.yml` (PR Reviewer Bot):**
   - Tự động rà soát code, kiểm tra tính tuân thủ với [`API_CONTRACTS.md`](API_CONTRACTS.md) và checklist [`PROJECT_TODO.md`](PROJECT_TODO.md).
3. **`auto-merge.yml` (Auto Merge):**
   - Tự động thực hiện **Squash and Merge** khi toàn bộ kiểm thử CI đã pass và không có xung đột (conflict). Nhánh tính năng tạm thời sẽ tự động được dọn dẹp xóa bỏ.

---

## 📐 5. QUY CHUẨN MÃ NGUỒN & HỢP ĐỒNG API
- Mọi API Backend/AI bắt buộc tuân theo định dạng phản hồi chuẩn trong file [`API_CONTRACTS.md`](API_CONTRACTS.md).
- Mã lỗi và cấu trúc JSON chuẩn:
  ```json
  {
    "code": 200,
    "message": "Mô tả kết quả",
    "data": { ... }
  }
  ```
- Luôn kiểm tra và đánh dấu tick `[x]` vào [`PROJECT_TODO.md`](PROJECT_TODO.md) khi hoàn thành từng hạng mục công việc.

<!-- Dummy line to allow commit -->
