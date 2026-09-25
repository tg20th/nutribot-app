# HƯỚNG DẪN QUY CHUẨN DÀNH CHO AI AGENT (ANTIGRAVITY & SUBAGENTS)
> **Dự án:** NutriBot - Hệ thống Tư vấn Dinh dưỡng Cá nhân hóa (SWP391 - Nhóm 7)  
> **Repository:** `tg20th/swp391-group7-nutribot`  
> **Jira Project Key:** `NB` (`https://danyngo06.atlassian.net`)

---

## 👥 1. THÀNH VIÊN VÀ PHÂN CÔNG VAI TRÒ
Dự án được thực hiện bởi 4 thành viên. Khi code hoặc tạo branch/task, Agent phải luôn nhận biết đúng phạm vi:
1. **Trường (Backend):** `ngonhattruong555@gmail.com`
   - Phạm vi: Auth, Spring Security, JWT, User & Role, Content (Blog & Video), Comments, Votes, Admin Backend APIs.
2. **Thắng (Backend):** `minhthangphuocbuu@gmail.com`
   - Phạm vi: Profile cá nhân, Health Metrics & Dị ứng, tự động tính BMI, Category, Weekly Menu, Restaurant GPS, Java AI Gateway.
3. **Lan (AI & Frontend):** `tuyetlanlt21@gmail.com`
   - Phạm vi: Python AI Microservice (FastAPI, Gemini LLM prompt, Meal Planner) + React UI cho Auth, Profile, Chatbot NutriBot, Weekly Planner.
4. **Khánh (BA & Frontend):** `luongminhkhanh20@gmail.com`
   - Phạm vi: React UI Admin Dashboard (4 màn hình quản trị), Blog & Video UI, Bình luận & Thả tim, Nhà hàng & Bản đồ GPS.

---

## 🌿 2. QUY CHUẨN GIT & BRANCHING

### 2.1. Đặt tên Branch:
Mỗi khi phát triển một task mới, Agent hoặc lập trình viên phải tạo branch theo đúng cú pháp:
```bash
feat/NB-<mã_task>-<tên_ngắn>-<tên_thành_viên>
fix/NB-<mã_task>-<tên_ngắn>-<tên_thành_viên>
```
*Ví dụ:*
- `feat/NB-02-register-truong`
- `feat/NB-10-bmi-thang`
- `feat/NB-32-fastapi-lan`
- `feat/NB-16-blog-ui-khanh`

### 2.2. QUY CHUẨN COMMIT MESSAGE (BẮT BUỘC - 100% TIẾNG VIỆT):
Agent **BẮT BUỘC** viết commit message bằng **100% Tiếng Việt**, tuân thủ nghiêm ngặt chuẩn kỹ thuật **Git 50/72**:

```text
<loại>(NB-<mã_task>-<TẦNG>): <Tiêu đề ngắn 50 - 72 ký tự tiếng Việt> [#done]

- <Gạch đầu dòng 1: Chi tiết file/tính năng đã tạo hoặc chỉnh sửa>
- <Gạch đầu dòng 2: Xử lý logic nghiệp vụ, xác thực hoặc bảo mật>
- <Gạch đầu dòng 3: Kết quả kiểm thử Unit Test/Build>
```

#### Quy tắc chi tiết:
- `<loại>`: `feat` (tính năng mới), `fix` (sửa lỗi), `test` (viết kiểm thử), `refactor` (tối ưu hóa code).
- `<TẦNG>`: Bắt buộc chọn 1 trong 3: `BE` (Backend), `FE` (Frontend), hoặc `AI` (AI Service).
- **Tiêu đề (Dòng 1):** Độ dài từ 50 đến tối đa 72 ký tự. Bắt đầu bằng động từ tiếng Việt (*hoàn thành, xây dựng, tối ưu, sửa lỗi, bổ sung*).
- **Thêm `#done`:** Thêm `#done` ở cuối dòng 1 khi hoàn thành task để kích hoạt **Jira Smart Commits** tự động kéo task sang cột *Done*.
- **Thêm `#time <thời_gian>` (Tùy chọn):** Ví dụ `#time 2h` hoặc `#time 45m` để tự động ghi log thời gian vào Jira.
- **Sau khi PR merged vào `master`:** Agent PHẢI cập nhật `[x]` trong `PROJECT_TODO.md` (tick done), tạo commit riêng `chore: cập nhật PROJECT_TODO.md - <mô_tả>` và push lên `master`.
- **Thân commit (Body):** Cách dòng tiêu đề đúng 1 dòng trống. Dùng 2 đến 4 dấu gạch đầu dòng `-` mô tả chi tiết công việc.

#### Ví dụ Commit chuẩn mẫu:
```bash
git commit -m "feat(NB-02-BE): hoàn thành API đăng ký và mã hóa mật khẩu #done

- Tạo AuthController với endpoint POST /api/v1/auth/register
- Mã hóa mật khẩu người dùng bằng BCryptPasswordEncoder
- Bổ sung kiểm tra trùng lặp email và username trong DB
- Chạy unit test AuthControllerTest đạt 100%"
```

---

## 📐 3. NGUYÊN TẮC KIẾN TRÚC & HỢP ĐỒNG DỮ LIỆU

1. **Tuân thủ API_CONTRACTS.md:**
   - Mọi API Backend/AI bắt buộc tuân theo định dạng phản hồi chuẩn trong file [`API_CONTRACTS.md`](file:///c:/Users/PC/Documents/26FA/SWP391/Project/swp391_group7_nutribot/API_CONTRACTS.md).
   - Format JSON chuẩn (`ApiResponse<T>`):
     ```json
     {
       "success": true,
       "message": "Thao tác thành công",
       "data": { ... },
       "timestamp": "2026-09-24T08:30:00Z"
     }
     ```
   - Schema cơ sở dữ liệu: Luôn tham chiếu bảng và cột từ file [`backend/sql/Database.sql`](backend/sql/Database.sql) và [`backend/sql/SampleData.sql`](backend/sql/SampleData.sql).
2. **Tuân thủ PROJECT_TODO.md:**
   - Luôn kiểm tra file [`PROJECT_TODO.md`](file:///c:/Users/PC/Documents/26FA/SWP391/Project/swp391_group7_nutribot/PROJECT_TODO.md) trước khi code để nắm rõ: mã task `NB-xx`, mô tả nghiệp vụ, các file cần tạo, và danh sách task phụ thuộc (`Blocked by`).
   - Sau khi hoàn thành task, cập nhật dấu tick `[x]` vào file `PROJECT_TODO.md`.

3. **Công nghệ chuẩn của dự án:**
   - **Backend:** Java 25, Spring Boot 3.x, Spring Data JPA, Spring Security 6, JWT, MySQL 8.
   - **Frontend:** React 19, Vite, Tailwind CSS / Vanilla CSS, Axios, Lucide React.
   - **AI Microservice:** Python 3.12+, FastAPI, Uvicorn, Google Gemini API SDK (`google-genai`).

---

## 🤖 4. QUY TRÌNH TỰ ĐỘNG HÓA VỚI GITHUB ACTIONS
Khi Agent tạo Pull Request (PR) vào nhánh `master`:
1. Pipeline [`.github/workflows/ci.yml`](file:///c:/Users/PC/Documents/26FA/SWP391/Project/swp391_group7_nutribot/.github/workflows/ci.yml) sẽ tự động chạy test kiểm thử toàn diện cả 3 tầng BE, FE, AI.
2. Bot [`.github/workflows/ai-pr-reviewer.yml`](file:///c:/Users/PC/Documents/26FA/SWP391/Project/swp391_group7_nutribot/.github/workflows/ai-pr-reviewer.yml) sẽ tự động nhận xét đối soát checklist PR.
3. Bot [`.github/workflows/auto-merge.yml`](file:///c:/Users/PC/Documents/26FA/SWP391/Project/swp391_group7_nutribot/.github/workflows/auto-merge.yml) sẽ tự động Squash & Merge khi đạt điều kiện xanh CI.
