# NutriBot - Project Master To-Do Checklist (59 Tasks)

> **Dành cho 4 thành viên nhóm 7 (SWP391):** Trường (BE), Thắng (BE), Lan (AI & FE), Khánh (BA & FE)  
> **Jira Project Key:** `NB` (`https://danyngo06.atlassian.net`)  
> **Quy tắc phối hợp:** Mỗi thành viên tick `[x]` vào task khi hoàn thành. Tạo branch theo cú pháp `feat/NB-<mã>-<tên_ngắn>-<tên_bạn>`. Commit code bắt buộc **100% Tiếng Việt** theo chuẩn Git 50/72 và gắn mã task kèm `#done` + `Closes NB-x` trên cùng dòng (ví dụ: `git commit -m "feat(NB-02-BE): hoàn thành API đăng ký và mã hóa mật khẩu #done Closes NB-2"`). Chi tiết xem tại [`CONTRIBUTING.md`](CONTRIBUTING.md) và [`AGENTS.md`](AGENTS.md).

---

## 📊 Bảng tổng hợp phân công công việc

| Thành viên | Vai trò | Số lượng Task | Phạm vi sở hữu code chính |
| :--- | :---: | :---: | :--- |
| **Trường** | Backend | **14 tasks** | Auth, Security (JWT), User & Role, Content (Blog & Video), Comments, Votes, Admin APIs. |
| **Thắng** | Backend | **13 tasks** | Profile cá nhân, Health & Dị ứng, BMI, Category, Weekly Menu, Restaurant GPS, Java AI Gateway. |
| **Lan** | AI & FE | **17 tasks** | Python AI Microservice (FastAPI, LLM prompt, Meal Planner) + React UI cho Auth, Profile, Chatbot, Planner. |
| **Khánh** | BA & FE | **15 tasks** | React UI cho Admin Dashboard (4 màn hình), Blog/Video, Bình luận/Vote, Nhà hàng & Bản đồ GPS. |

---

## 🏃 SPRINT 1: Nền tảng, Quản lý Nội dung & Chatbot MVP (Tasks #1 - #32)

### ☕ TRƯỜNG (Backend - 7 tasks)
- [x] **#3 [BE] User & Role Entities & Repositories** ✅
  - *Mô tả:* Tạo JPA Entity `User`, `Role` map bảng `users`, `roles` trong `Database.sql`.
  - *File cần tạo:* `entity/Role.java`, `entity/User.java`, `repository/RoleRepository.java`, `repository/UserRepository.java`.
  - *Blocked by:* Không có.
- [x] **#2 [BE] Registration API & Password Handling** ✅
  - *Mô tả:* API `POST /api/v1/auth/register`, validate email/username duy nhất, mã hóa mật khẩu bằng BCrypt.
  - *File đã tạo:* `dto/request/RegisterRequest.java`, `service/AuthService.java`, `controller/AuthController.java`.
  - *Blocked by:* `#3` ✅ (đã xong).
- [x] **#5 [BE] Login Flow & JWT Token Generation** ✅
  - *Mô tả:* API `POST /api/v1/auth/login`, xác thực username/password, cấp phát JWT token có hạn sử dụng.
  - *File cần tạo:* `dto/request/LoginRequest.java`, `dto/response/AuthResponse.java`, `config/JwtTokenProvider.java`.
  - *Blocked by:* `#3`.
- [x] **#6 [BE] Spring Security Config & Logout** ✅
  - *Mô tả:* Cấu hình `SecurityFilterChain`, phân quyền `ROLE_USER`, `ROLE_ADMIN`, cho phép CORS từ port 5173/3000, API Đăng xuất.
  - *File cần tạo:* `config/SecurityConfig.java`, `config/JwtAuthenticationFilter.java`.
  - *Blocked by:* `#3`, `#5`.
- [x] **#17 [BE] Public Blog List & Detail APIs** ✅
  - *Mô tả:* Tạo Entity `Content` và API `GET /api/v1/blogs`, `GET /api/v1/blogs/{id}` phân trang các bài viết đã duyệt (`status='published'`).
  - *File cần tạo:* `entity/Content.java`, `repository/ContentRepository.java`, `controller/ContentController.java`.
  - *Blocked by:* Không có.
- [x] **#22 [BE] Public Video List & Detail APIs** ✅
  - *Mô tả:* Tận dụng bảng `contents` với `content_type='VIDEO'`, API `GET /api/v1/videos`, `GET /api/v1/videos/{id}`.
  - *File cần tạo:* Bổ sung query trong `ContentRepository.java` và endpoint trong `ContentController.java`.
  - *Blocked by:* Không có.
- [x] **#19 & #24 [BE] Author Blog/Video CRUD & Upload** ✅
  - *Mô tả:* API cho tác giả thêm, sửa, xóa Blog (`POST/PUT/DELETE /api/v1/blogs`) và Video (`POST/PUT/DELETE /api/v1/videos`), kiểm tra quyền sở hữu bài viết.
  - *Blocked by:* `#17`, `#22`.
- [ ] **#13 [BE] API Lấy dữ liệu Trang chủ tổng hợp**
  - *Mô tả:* API `GET /api/v1/home` tổng hợp blog nổi bật, video mới nhất và danh mục.
  - *File cần tạo:* `dto/response/HomeSummaryResponse.java`, `controller/HomeController.java`.
  - *Blocked by:* `#17`, `#22`.
- [ ] **#15 [BE] API Tìm kiếm Đa tiêu chí cho Blog & Video**
  - *Mô tả:* API `GET /api/v1/search` tìm kiếm nội dung theo keyword, categoryId, contentType.
  - *File cần tạo:* `controller/SearchController.java`, `service/SearchService.java`.
  - *Blocked by:* `#17`, `#22`.
- [ ] **#27 [BE] API CRUD Bình luận (Comment Engine)**
  - *Mô tả:* Entity Comment, API `GET/POST/DELETE /api/v1/comments`, hỗ trợ bình luận lồng nhau.
  - *File cần tạo:* `entity/Comment.java`, `repository/CommentRepository.java`, `controller/CommentController.java`.
- [ ] **#28 [BE] API Like/Vote & Chống Trùng lặp**
  - *Mô tả:* Entity Vote, API `POST /api/v1/votes/toggle`, 1 user chỉ vote 1 lần.
  - *File cần tạo:* `entity/Vote.java`, `repository/VoteRepository.java`, `controller/VoteController.java`.

---

### ☕ THẮNG (Backend - 5 tasks)
- [ ] **#11 [BE] UserProfile, Ingredient, UserAllergy Entities & Repositories**
  - *Mô tả:* Tạo Entity `UserProfile`, `Ingredient` map bảng `user_profiles`, `ingredients`, bảng trung gian `user_allergies`.
  - *File cần tạo:* `entity/UserProfile.java`, `entity/Ingredient.java`, `repository/UserProfileRepository.java`, `repository/IngredientRepository.java`.
  - *Blocked by:* Không có.
- [ ] **#8 [BE] User Profile GET/UPDATE APIs**
  - *Mô tả:* API `GET /api/v1/users/profile` và `PUT /api/v1/users/profile` xem/sửa thông tin cá nhân cơ bản.
  - *File cần tạo:* `service/UserProfileService.java`, `controller/UserProfileController.java`.
  - *Blocked by:* `#11`.
- [ ] **#10 [BE] Health Profile & Automatic BMI Calculation**
  - *Mô tả:* API `PUT /api/v1/users/profile/health` cập nhật chiều cao, cân nặng, danh sách dị ứng; tự động tính $BMI = weight / (height^2)$ và phân loại thể trạng.
  - *File cần tạo:* `dto/request/HealthProfileUpdateRequest.java`, bổ sung logic tính toán trong `UserProfileServiceImpl.java`.
  - *Blocked by:* `#11`.
- [ ] **#34 [BE] Category Management CRUD API**
  - *Mô tả:* Tạo Entity `Category` và API `GET/POST/PUT/DELETE /api/v1/categories` (đẩy sớm vào Sprint 1 để cung cấp ID phân loại cho Blog/Video).
  - *File cần tạo:* `entity/Category.java`, `repository/CategoryRepository.java`, `controller/CategoryController.java`.
  - *Blocked by:* Không có.
- [ ] **#31 [BE] Java Chatbot Gateway Service**
  - *Mô tả:* Dùng `RestClient` trong Spring Boot làm cầu nối gọi sang Python AI Service của Lan (`POST http://localhost:8000/api/ai/chat`), có cơ chế fallback khi AI bận.
  - *File cần tạo:* `service/ChatbotGatewayService.java`, `controller/ChatbotController.java` (`POST /api/v1/chatbot/query`).
  - *Blocked by:* Không có (có thể mock data trước khi Lan hoàn thành Python).

---

### 🤖 LAN (AI Specialist & React FE - 13 tasks)
- [ ] **#32 [AI] Dựng Python FastAPI AI Service & NutriBot System Prompt**
  - *Mô tả:* Dựng ứng dụng FastAPI trong thư mục `ai-service/`, kết nối Gemini/OpenAI API, cấu hình System Prompt chuyên gia dinh dưỡng thực vật, mở endpoint `POST /api/ai/chat`.
  - *File cần tạo:* `ai-service/main.py`, `ai-service/requirements.txt`, `ai-service/Dockerfile`.
- [x] **#1 [FE] Màn hình Đăng ký (`/register`)** ✅
  - *Mô tả:* Form đăng ký tài khoản, kiểm tra định dạng email, mật khẩu khớp, thông báo lỗi trực quan.
  - *File cần tạo:* `frontend/src/pages/RegisterPage.jsx`.
- [x] **#4 [FE] Màn hình Đăng nhập (`/login`)** ✅
  - *Mô tả:* Form đăng nhập, gọi API nhận JWT Token, lưu vào `localStorage`, chuyển hướng người dùng.
  - *File cần tạo:* `frontend/src/pages/LoginPage.jsx`.
- [ ] **#7 [FE] Màn hình Thông tin cá nhân (`/profile`)**
  - *Mô tả:* Hiển thị họ tên, email, ngày sinh, giới tính và cho phép cập nhật.
  - *File cần tạo:* `frontend/src/pages/ProfilePage.jsx`.
- [ ] **#9 [FE] Màn hình Hồ sơ Sức khỏe & Dị ứng**
  - *Mô tả:* Form nhập chiều cao, cân nặng, thanh đo BMI hiển thị thể trạng, danh sách thẻ chọn nguyên liệu dị ứng.
  - *File cần tạo:* `frontend/src/components/profile/HealthProfileSection.jsx`.
- [x] **#12 [FE] Layout Trang chủ (`/home`)** ✅
  - *Mô tả:* Hero banner chào mừng, thanh tìm kiếm nhanh, khối hiển thị các bài viết và video mới nhất.
  - *File cần tạo:* `frontend/src/pages/HomePage.jsx`.
- [ ] **#14 [FE] Màn hình Tìm kiếm & Bộ lọc nội dung**
  - *Mô tả:* Giao diện kết quả tìm kiếm với bộ lọc theo danh mục, từ khóa và sắp xếp ngày đăng.
  - *File cần tạo:* `frontend/src/pages/SearchPage.jsx`.
- [x] **#29 [FE] Floating Chatbot Widget** ✅
  - *Mô tả:* Nút tròn góc phải dưới màn hình, bấm mở/thu nhỏ khung chat, giao diện bong bóng tin nhắn.
  - *File cần tạo:* `frontend/src/components/chatbot/ChatbotWidget.jsx`.
- [x] **#30 [FE] Tích hợp Gửi/Nhận Chatbot** ✅
  - *Mô tả:* Kết nối widget chat với endpoint `/api/v1/chatbot/query`, hiển thị trạng thái đang trả lời (typing indicator).
  - *File cần tạo:* `frontend/src/components/chatbot/ChatWindow.jsx`.

---

### 📋 KHÁNH (BA & React FE - 7 tasks)
- [ ] **#16 [FE] Màn hình Danh sách & Chi tiết Blog**
  - *Mô tả:* Trang lưới các bài viết blog kèm phân trang và trang đọc nội dung bài viết chi tiết.
  - *File cần tạo:* `frontend/src/pages/BlogListPage.jsx`, `frontend/src/pages/BlogDetailPage.jsx`.
- [ ] **#18 [FE] Form Soạn thảo & Đăng Blog**
  - *Mô tả:* Trình soạn thảo văn bản, upload ảnh thumbnail, chọn danh mục bài viết.
  - *File cần tạo:* `frontend/src/pages/CreateBlogPage.jsx`.
- [ ] **#20 [FE] Màn hình "Blog của tôi"**
  - *Mô tả:* Danh sách bài viết cá nhân đã đăng, nút sửa bài và nút xóa bài kèm dialog xác nhận.
  - *File cần tạo:* `frontend/src/pages/MyBlogsPage.jsx`.
- [ ] **#21 [FE] Màn hình Danh sách & Chi tiết Video nấu ăn**
  - *Mô tả:* Lưới video hướng dẫn nấu ăn lành mạnh và màn hình xem video phát trực tiếp.
  - *File cần tạo:* `frontend/src/pages/VideoListPage.jsx`, `frontend/src/pages/VideoDetailPage.jsx`.
- [ ] **#23 [FE] Form Đăng tải Video**
  - *Mô tả:* Nhập tiêu đề, mô tả, gắn URL video (YouTube/MP4), chọn thời lượng và danh mục.
  - *File cần tạo:* `frontend/src/pages/CreateVideoPage.jsx`.
- [ ] **#25 [FE] Màn hình "Video của tôi"**
  - *Mô tả:* Quản lý các video đã đăng tải của tài khoản cá nhân.
  - *File cần tạo:* `frontend/src/pages/MyVideosPage.jsx`.
- [ ] **#26 [FE] Khối Bình luận & Like/Vote**
  - *Mô tả:* Component hiển thị dưới bài viết Blog và Video: ô nhập bình luận, danh sách phản hồi, nút Like hiển thị số lượt thích.
  - *File cần tạo:* `frontend/src/components/content/CommentSection.jsx`, `VoteButton.jsx`.

---

## 🏃 SPRINT 2: Quản trị Admin, Thực đơn Tuần & Nhà hàng GPS (Tasks #33 - #51)

### ☕ TRƯỜNG (Backend - 5 tasks)
- [x] **#36 [BE] Admin API: Quản lý Người dùng** ✅
  - *Mô tả:* API `GET /api/v1/admin/users` (phân trang, tìm kiếm), `PUT /api/v1/admin/users/{id}/status` (khóa/mở khóa tài khoản).
  - *File cần tạo:* `controller/AdminUserController.java`.
- [x] **#38 [BE] Admin API: Kiểm duyệt Nội dung Blog/Video** ✅
  - *Mô tả:* API `GET /api/v1/admin/contents`, `PUT /api/v1/admin/contents/{id}/status` (duyệt, ẩn, xóa bài vi phạm).
  - *File cần tạo:* `controller/AdminContentController.java`.
- [x] **#40 [BE] Admin API: Quản lý & Xóa Bình luận Vi phạm** ✅
  - *Mô tả:* API `GET /api/v1/admin/comments`, `DELETE /api/v1/admin/comments/{id}`.
- [ ] **#57 [BE] API Gợi ý Nhà hàng theo Món ăn**
  - *Mô tả:* API `GET /api/v1/restaurants/recommend?dishId=...` kết nối logic gợi ý của Lan để trả về danh sách nhà hàng tương ứng.
- [ ] **#59 [BE] API Gợi ý Bài viết / Video Liên quan**
  - *Mô tả:* API `GET /api/v1/contents/{id}/related` trả về 4-6 bài viết/video cùng chủ đề.

---

### ☕ THẮNG (Backend - 6 tasks)
- [ ] **#43 [BE] Entities Thực đơn Tuần & Món ăn**
  - *Mô tả:* Tạo các Entity `Dish`, `WeeklyMenu`, `WeeklyMenuMeal`, `WeeklyMenuItem` map bảng `dishes`, `weekly_menus`, `weekly_menu_meals`, `weekly_menu_items`.
  - *File cần tạo:* Các class trong package `entity/` và `repository/`.
- [ ] **#42 [BE] API CRUD Thực đơn Tuần (Weekly Menu Engine)**
  - *Mô tả:* API `POST /api/v1/weekly-menus` tạo lịch ăn 7 ngày, `POST /api/v1/weekly-menus/{id}/items` thêm món vào bữa, `DELETE /api/v1/weekly-menus/{id}/items/{itemId}`.
  - *File cần tạo:* `service/WeeklyMenuService.java`, `controller/WeeklyMenuController.java`.
- [ ] **#45 [BE] API Danh sách & Chi tiết Nhà hàng**
  - *Mô tả:* Tạo Entity `Restaurant`, API `GET /api/v1/restaurants`, `GET /api/v1/restaurants/{id}` tra cứu quán ăn chay/healthy.
  - *File cần tạo:* `entity/Restaurant.java`, `controller/RestaurantController.java`.
- [ ] **#47 [BE] API Tìm kiếm Nhà hàng lân cận theo Tọa độ GPS**
  - *Mô tả:* API `GET /api/v1/restaurants/nearby?lat=...&lng=...&radiusKm=5` tính khoảng cách đường chim bay bằng công thức Haversine.
- [ ] **#49 [BE] Lưu trữ Lịch sử Hội thoại Chatbot**
  - *Mô tả:* Tạo Entity `ChatSession`, `ChatMessage`, API `GET /api/v1/chatbot/sessions` và `GET /api/v1/chatbot/sessions/{id}/messages` tải lại các đoạn chat cũ.
- [ ] **#51 [BE] Quản lý Giới hạn Lượt Chat Khách Vãng lai**
  - *Mô tả:* Theo dõi `trial_query_count <= 3` cho khách chưa đăng nhập, tự động khóa khi hết lượt dùng thử.

---

### 🤖 LAN (AI Specialist & React FE - 3 tasks)
- [ ] **#48 [FE] Màn hình Lịch sử Trò chuyện Chatbot**
  - *Mô tả:* Danh sách các phiên trò chuyện cũ ở thanh bên (Sidebar), bấm chọn để xem lại toàn bộ nội dung đã hỏi đáp với NutriBot.
  - *File cần tạo:* `frontend/src/pages/ChatHistoryPage.jsx`.
- [ ] **#50 [FE] Giao diện Giới hạn Khách vãng lai**
  - *Mô tả:* Badge hiển thị số câu hỏi dùng thử còn lại ("Còn 2/3 câu hỏi"), modal thông báo hết lượt kèm nút Đăng ký/Đăng nhập.
- [ ] **#41 [FE] Màn hình Quản lý Thực đơn Tuần**
  - *Mô tả:* Bảng lịch 7 ngày trong tuần, các slot bữa sáng, trưa, tối, nút thêm món ăn và xóa món ăn trực tiếp trên lịch.
  - *File cần tạo:* `frontend/src/pages/WeeklyMenuPage.jsx`.

---

### 📋 KHÁNH (BA & React FE - 6 tasks)
- [ ] **#33 [FE] Màn hình Admin: Quản lý Danh mục (`/admin/categories`)**
  - *Mô tả:* Bảng quản lý danh mục món ăn/nguyên liệu, modal thêm/sửa danh mục, lọc theo loại.
- [ ] **#35 [FE] Màn hình Admin: Quản lý Thành viên (`/admin/users`)**
  - *Mô tả:* Bảng danh sách thành viên, tìm kiếm theo email/username, nút chuyển đổi trạng thái Khóa / Mở khóa tài khoản.
- [ ] **#37 [FE] Màn hình Admin: Kiểm duyệt Nội dung (`/admin/moderation`)**
  - *Mô tả:* Hàng đợi các bài viết Blog/Video chờ duyệt, xem nội dung chi tiết, nút Duyệt / Từ chối / Ẩn bài.
- [ ] **#39 [FE] Màn hình Admin: Quản lý Bình luận (`/admin/comments`)**
  - *Mô tả:* Danh sách bình luận bị báo cáo xấu và thao tác xóa bình luận.
- [ ] **#44 [FE] Màn hình Danh sách Nhà hàng Chay/Healthy (`/restaurants`)**
  - *Mô tả:* Thẻ thông tin nhà hàng, lọc theo khu vực/quận huyện, hình ảnh và địa chỉ.
- [ ] **#46 [FE] Màn hình Bản đồ Nhà hàng GPS (`/restaurants/map`)**
  - *Mô tả:* Nút xin quyền vị trí GPS của người dùng, hiển thị bản đồ và cắm mốc các quán ăn gần nhất trong bán kính 5km.

---

## 🏃 SPRINT 3: Lập Thực đơn Thông minh AI & Đề xuất Nâng cao (Tasks #52 - #59)

### 🤖 LAN (AI Specialist & React FE - 4 tasks)
- [ ] **#54 [AI] Pipeline Sinh Thực đơn Tuần Cá nhân hóa (AI Meal Planner Engine)**
  - *Mô tả:* Tiếp nhận chỉ số BMI, mục tiêu calo, nguyên liệu có sẵn trong tủ lạnh, loại trừ các nguyên liệu dị ứng -> Prompt LLM sinh cấu trúc thực đơn 7 ngày hợp lý.
  - *File cần tạo:* `ai-service/planner.py`, endpoint `POST /api/ai/generate-meal-plan`.
- [ ] **#57 [AI] Thuật toán So khớp Món ăn với Nhà hàng**
  - *Mô tả:* Phân tích món ăn người dùng yêu thích để gợi ý nhà hàng có phục vụ món tương tự.
- [ ] **#59 [AI] Thuật toán Xếp hạng & Gợi ý Nội dung Liên quan**
  - *Mô tả:* So khớp độ tương đồng về tag và danh mục để đề xuất các bài viết/video liên quan.
- [ ] **#52 & #53 [FE] Giao diện Lập Thực đơn AI & Xem trước Thực đơn**
  - *Mô tả:* Form nhập thông tin nguyên liệu trong tủ lạnh -> Bấm "Tạo thực đơn" -> Hiển thị bản Preview 7 ngày do AI gợi ý -> Bấm "Lưu vào thực đơn của tôi".
  - *File cần tạo:* `frontend/src/pages/MealPlannerPage.jsx`.

---

### ☕ THẮNG (Backend - 2 tasks)
- [ ] **#55 [BE] Tích hợp Lưu Thực đơn do AI Sinh vào CSDL**
  - *Mô tả:* API tiếp nhận payload thực đơn từ giao diện (do AI của Lan sinh ra) và lưu chính thức vào bảng `weekly_menus` và `weekly_menu_items`.
- [ ] **#57 [BE] API Gợi ý Nhà hàng theo Món ăn**
  - *Mô tả:* API `GET /api/v1/restaurants/recommend?dishId=...` kết nối logic gợi ý của Lan để trả về danh sách nhà hàng tương ứng.

---

### ☕ TRƯỜNG (Backend - 2 tasks)
- [ ] **#13 & #15 [BE] Hoàn thiện API Trang chủ & Tìm kiếm Đa tiêu chí**
  - *Mô tả:* API `GET /api/v1/home/latest` tổng hợp bài viết mới nhất và `GET /api/v1/contents/search` tìm kiếm full-text theo từ khóa và danh mục.
- [ ] **#59 [BE] API Gợi ý Bài viết / Video Liên quan**
  - *Mô tả:* API `GET /api/v1/contents/{id}/related` trả về 4-6 bài viết/video cùng chủ đề.

---

### 📋 KHÁNH (BA & React FE - 2 tasks)
- [ ] **#56 [FE] Component Thẻ Gợi ý Nhà hàng**
  - *Mô tả:* Hiển thị dưới trang chi tiết món ăn/công thức: "Bạn có thể thưởng thức món này tại các nhà hàng sau".
- [ ] **#58 [FE] Component Khối Nội dung Liên quan**
  - *Mô tả:* Hiển thị các bài viết và video gợi ý liên quan ở cuối trang bài viết.
