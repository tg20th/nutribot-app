# NutriBot - Backend & Full-Stack Development Roadmap & Architecture Spec

- **Dự án:** NutriBot (Hệ sinh thái Tư vấn Dinh dưỡng, Gợi ý Thực đơn Tuần & Cộng đồng Món ăn Healthy)
- **Mã môn:** SWP391 - Nhóm 7 (FPT University)
- **Ngày lập:** 24/09/2026
- **Trạng thái:** Validated Design Spec

---

## 1. Bối cảnh & Chuyên môn Đội ngũ phát triển

Dự án gồm 4 thành viên với phân vai theo đúng chuyên môn và thế mạnh thực tế:

| Thành viên | Vai trò chính | Chuyên môn / Công nghệ đảm nhận | Trọng tâm công việc |
| :--- | :--- | :--- | :--- |
| **Trường** | Backend Specialist | Java 25, Spring Boot 4.1.1, Spring Security, JWT, JPA | Module Xác thực (Auth), Bảo mật (Security), Quản lý Người dùng, Nội dung Blog & Video (bảng `contents`), Bình luận, Like/Vote, Quản trị viên (Admin). |
| **Thắng** | Backend Specialist | Java 25, Spring Boot 4.1.1, Spring Data JPA, REST Gateway | Module Hồ sơ Dinh dưỡng & Dị ứng, Danh mục (Category), Thực đơn Tuần & Món ăn (Weekly Menu & Dishes), Nhà hàng & Định vị GPS (Haversine), Cổng kết nối AI Chatbot Gateway & Lưu trữ lịch sử chat. |
| **Lan** | AI Specialist & FE | Python (FastAPI), LangChain/LLM (Gemini/OpenAI), React | Toàn bộ **AI Python Microservice** (Prompt engineering, LLM integration, AI Meal Planner reasoning, thuật toán gợi ý) + Màn hình React FE cho luồng Người dùng cốt lõi & AI (Auth, Profile, Chatbot Widget, Meal Planner). |
| **Khánh** | BA & React FE | Business Analysis, React (dùng AI sinh code UI) | Nắm vững nghiệp vụ hệ thống; sử dụng AI để sinh mã nguồn React Frontend cho các màn hình có cấu trúc rõ ràng: Cổng Admin Dashboard (4 màn hình), Màn hình Blog/Video cá nhân & công khai, Màn hình Nhà hàng & Bản đồ. |

---

## 2. Kiến trúc Hệ thống & Chiến lược "Zero Blocker"

### 2.1. Sơ đồ kiến trúc tổng thể

```
[ CLIENT - FRONTEND ]
  React App (Port 3000 / 5173)
  ├── Lan: /auth/*, /profile, /chatbot, /menu, /planner
  └── Khánh: /blogs/*, /videos/*, /restaurants/*, /admin/*
        │
        │ HTTP REST (JSON chuẩn ApiResponse<T>)
        ▼
[ CORE BACKEND ]
  Spring Boot 4.1.1 (Java 25 - Port 8080)
  ├── Trường Domain: Auth, Security, Content (Blog/Video), Interaction, Admin
  └── Thắng Domain: User Profile, Category, Weekly Menu, Restaurant, AI Gateway
        │
        │ HTTP REST (Private Network)
        ▼
[ AI MICROSERVICE ]
  Python FastAPI (Port 8000) - Lan
  ├── NutriBot System Prompt (Dinh dưỡng chay/healthy)
  ├── Gemini / OpenAI LLM Wrapper
  └── AI Personalized Meal Planning Algorithm
```

### 2.2. Chiến lược loại bỏ nghẽn (Zero Blocker)

1. **FE không bị block bởi BE (Contract-First & Mock Data):**
   - Vào Ngày 1 của mỗi Sprint, team thống nhất định dạng JSON Request/Response (DTO) và lưu vào tài liệu API Contract chung.
   - Lan và Khánh dùng mock data JSON cục bộ để render toàn bộ UI, xử lý validate và tương tác mà không cần chờ Spring Boot server khởi chạy.
   - Khi BE hoàn tất API, FE chỉ cần thay đổi đường dẫn `API_BASE_URL`.
2. **Trường và Thắng không bị block lẫn nhau (Domain Decoupling):**
   - **Trường** làm việc độc quyền trên các bảng: `users`, `roles`, `contents`, `comments`, `votes`.
   - **Thắng** làm việc độc quyền trên các bảng: `user_profiles`, `categories`, `ingredients`, `user_allergies`, `dishes`, `weekly_menus`, `weekly_menu_meals`, `weekly_menu_items`, `restaurants`, `restaurant_dishes`, `chat_sessions`, `chat_messages`.
   - Cả 2 bắt đầu tạo Entity và viết API của mình song song từ Ngày 1 mà không phụ thuộc nhau.
3. **Lan (AI) và Thắng (Java Gateway) không bị block:**
   - Lan phát triển độc lập trong thư mục `ai-service/` với FastAPI (Port 8000), kiểm thử bằng Postman/Swagger của FastAPI.
   - Thắng tạo Service Gateway trong Spring Boot; khi Lan chưa xong, Thắng dùng Mock Service trả về chuỗi text mẫu để hoàn thiện luồng Database `chat_sessions` và `chat_messages`.

---

## 3. Phase 0: Thiết lập Nền tảng Dùng chung (Prerequisites trước Sprint 1)

Cần được thực hiện ngay tại commit đầu tiên trước khi triển khai các domain riêng biệt:

- **DB Connection:** Cấu hình MSSQL trong `application.properties`:
  ```properties
  spring.datasource.url=jdbc:sqlserver://localhost:1433;databaseName=NutriBotV2;encrypt=true;trustServerCertificate=true
  spring.datasource.username=sa
  spring.datasource.password=your_password
  spring.jpa.hibernate.ddl-auto=validate
  spring.jpa.show-sql=true
  ```
- **Chuẩn hóa phản hồi API (`ApiResponse<T>`):**
  ```java
  public record ApiResponse<T>(
      boolean success,
      String message,
      T data,
      Instant timestamp
  ) {
      public static <T> ApiResponse<T> ok(T data) {
          return new ApiResponse<>(true, "Success", data, Instant.now());
      }
      public static <T> ApiResponse<T> error(String message) {
          return new ApiResponse<>(false, message, null, Instant.now());
      }
  }
  ```
- **Xử lý Ngoại lệ tập trung (`GlobalExceptionHandler`):** Bắt `MethodArgumentNotValidException`, `ResourceNotFoundException`, `BadCredentialsException`.
- **Thực thể gốc (`BaseEntity`):** Tự động gán `created_at` và `updated_at`.

---

## 4. Chi tiết Roadmap To-Do theo từng Sprint (59 Tasks)

### 4.1. Sprint 1: Khởi tạo Nền tảng, Quản lý Nội dung & Chatbot MVP (Tasks #1 - #32)

#### ☕ **Trường (BE - 7 tasks: Identity, Security & Content Engine)**
- [ ] **Task #3 [BE]**: Tạo Entity & Repository cho `User`, `Role` (Map bảng `users`, `roles`).
- [ ] **Task #2 [BE]**: Viết Service & Controller Đăng ký tài khoản (`POST /api/v1/auth/register`), mã hóa mật khẩu bằng BCrypt, validate tính duy nhất của username/email. *(Blocked by #3)*
- [ ] **Task #5 [BE]**: Viết Service & Controller Đăng nhập (`POST /api/v1/auth/login`), xác thực thông tin đăng nhập và cấp phát JWT Token. *(Blocked by #3)*
- [ ] **Task #6 [BE]**: Cấu hình `SecurityFilterChain`, thiết lập Role-based authorization (`USER`, `ADMIN`), API Đăng xuất (`POST /api/v1/auth/logout`). *(Blocked by #3, #5)*
- [ ] **Task #17 [BE]**: Tạo Entity `Content`, viết API công khai xem Danh sách & Chi tiết Blog (`GET /api/v1/blogs`, `GET /api/v1/blogs/{id}`).
- [ ] **Task #22 [BE]**: Viết API công khai xem Danh sách & Chi tiết Video nấu ăn (`GET /api/v1/videos`, `GET /api/v1/videos/{id}`) sử dụng chung bảng `contents`.
- [ ] **Task #19 & #24 [BE]**: Viết API Thêm, Sửa, Xóa Blog & Video cá nhân của User (`POST`, `PUT`, `DELETE /api/v1/blogs`, `/api/v1/videos`) kèm xử lý upload file ảnh/URL video. *(Blocked by #17, #22)*

#### ☕ **Thắng (BE - 5 tasks: Nutrition Profile, Category & AI Gateway)**
- [ ] **Task #11 [BE]**: Tạo Entity & Repository cho `UserProfile`, `Ingredient`, `UserAllergy` (Map bảng `user_profiles`, `ingredients`, `user_allergies`).
- [ ] **Task #8 [BE]**: Viết Service & API lấy/cập nhật thông tin Profile cá nhân (`GET /api/v1/users/profile`, `PUT /api/v1/users/profile`). *(Blocked by #11)*
- [ ] **Task #10 [BE]**: Viết API cập nhật chỉ số cơ thể (chiều cao, cân nặng), mục tiêu sức khỏe, danh sách dị ứng + tự động tính chỉ số BMI. *(Blocked by #11)*
- [ ] **Task #34 [BE]**: Tạo Entity `Category` & API CRUD Danh mục (`GET`, `POST`, `PUT`, `DELETE /api/v1/categories`) — *Đẩy sớm lên Sprint 1 để cung cấp ID phân loại món ăn/nguyên liệu cho Blog và Video*.
- [ ] **Task #31 [BE]**: Viết Java Gateway (`ChatbotClient`) sử dụng `RestClient` để chuyển tiếp câu hỏi từ Spring Boot sang Python AI Service của Lan (`POST /api/v1/chatbot/query`).

#### 🤖 **Lan (AI & FE - 13 tasks: Python AI Brain & User Journey FE)**
- **Python AI Microservice (`ai-service/`):**
  - [ ] **Task #32 [AI]**: Khởi tạo project FastAPI, cấu hình API key Gemini/OpenAI, viết System Prompt cho NutriBot (chuyên gia dinh dưỡng healthy), xuất endpoint `POST /api/ai/chat`.
- **Frontend React:**
  - [ ] **Task #1 [FE]**: Xây dựng UI Đăng ký tài khoản (`/register`) kèm kiểm tra lỗi form.
  - [ ] **Task #4 [FE]**: Xây dựng UI Đăng nhập (`/login`) và lưu JWT Token.
  - [ ] **Task #7 [FE]**: Xây dựng UI Trang Profile xem và sửa thông tin cơ bản.
  - [ ] **Task #9 [FE]**: Xây dựng UI cập nhật chiều cao, cân nặng, thẻ chọn nguyên liệu dị ứng và hiển thị thước đo BMI.
  - [ ] **Task #12 [FE]**: Xây dựng Layout Trang chủ (`/home`: Hero banner, thanh tìm kiếm, danh mục nổi bật).
  - [ ] **Task #14 [FE]**: Xây dựng UI Trang tìm kiếm & bộ lọc nội dung.
  - [ ] **Task #29 [FE]**: Xây dựng Floating Chatbot Widget (nút tròn góc phải, cửa sổ chat, danh sách tin nhắn).
  - [ ] **Task #30 [FE]**: Tích hợp luồng gửi/nhận tin nhắn của Chatbot Widget tới Backend API Java (`/api/v1/chatbot/query`).

#### 📋 **Khánh (BA & React FE - 7 tasks: Content Screens & Interactions)**
- [ ] **Task #16 [FE]**: Màn hình Danh sách Blog (lưới bài viết, phân trang) & Màn hình Chi tiết bài viết Blog.
- [ ] **Task #18 [FE]**: Form soạn thảo và đăng Blog (Rich Text Editor, chọn ảnh bìa, chọn category).
- [ ] **Task #20 [FE]**: Màn hình "Blog của tôi" (quản lý danh sách bài viết cá nhân, thao tác xóa bài).
- [ ] **Task #21 [FE]**: Màn hình Danh sách Video hướng dẫn nấu ăn & Màn hình Phát video chi tiết.
- [ ] **Task #23 [FE]**: Form đăng tải Video (nhập tiêu đề, mô tả, gắn URL YouTube/mp4, chọn danh mục).
- [ ] **Task #25 [FE]**: Màn hình "Video của tôi" (danh sách video cá nhân, nút xóa video).
- [ ] **Task #26 [FE]**: Component Bình luận & Nút Vote/Like đặt dưới bài viết Blog và Video.

---

### 4.2. Sprint 2: Quản trị Admin, Thực đơn tuần, Nhà hàng & Lịch sử Chat (Tasks #33 - #51)

#### ☕ **Trường (BE - 5 tasks: Interactions & Admin Operations)**
- [ ] **Task #27 [BE]**: Tạo Entity `Comment` & API CRUD bình luận (`POST`, `GET`, `DELETE /api/v1/contents/{id}/comments`). *(Blocked by #17)*
- [ ] **Task #28 [BE]**: Tạo Entity `Vote` & API Like/Vote bài viết, kiểm tra chống trùng lặp theo cặp (`user_id`, `content_id`). *(Blocked by #17)*
- [ ] **Task #36 [BE]**: Admin API Quản lý Người dùng (`GET /api/v1/admin/users`, `PUT /api/v1/admin/users/{id}/status` khóa/mở tài khoản, tìm kiếm, lọc).
- [ ] **Task #38 [BE]**: Admin API Quản lý Nội dung (`GET /api/v1/admin/contents`, `PUT /api/v1/admin/contents/{id}/status` ẩn/xóa bài vi phạm).
- [ ] **Task #40 [BE]**: Admin API Quản lý Bình luận (`GET /api/v1/admin/comments`, `DELETE /api/v1/admin/comments/{id}`).

#### ☕ **Thắng (BE - 6 tasks: Weekly Menu, Restaurant Discovery & Chat Persistence)**
- [ ] **Task #43 [BE]**: Tạo Entity & Repository cho `Dish`, `WeeklyMenu`, `WeeklyMenuMeal`, `WeeklyMenuItem` (Map các bảng thực đơn).
- [ ] **Task #42 [BE]**: Viết API CRUD Thực đơn tuần (`POST`, `GET`, `PUT`, `DELETE /api/v1/weekly-menus`) và quản lý chi tiết từng bữa ăn (sáng, trưa, tối, phụ). *(Blocked by #43)*
- [ ] **Task #45 [BE]**: Tạo Entity `Restaurant` & API tra cứu danh sách, chi tiết nhà hàng (`GET /api/v1/restaurants`, `GET /api/v1/restaurants/{id}`).
- [ ] **Task #47 [BE]**: Viết API tìm kiếm nhà hàng lân cận theo tọa độ GPS (`GET /api/v1/restaurants/nearby?lat=...&lng=...&radius=...`) áp dụng công thức khoảng cách Haversine. *(Blocked by #45)*
- [ ] **Task #49 [BE]**: Tạo Entity `ChatSession`, `ChatMessage` & API lưu trữ lịch sử hội thoại, tải lịch sử chat cũ của người dùng (`GET /api/v1/chatbot/sessions`, `GET /api/v1/chatbot/sessions/{id}/messages`).
- [ ] **Task #51 [BE]**: Viết logic kiểm soát lượt chat thử của khách vãng lai (tối đa 3 câu hỏi) dựa trên session ID hoặc IP.

#### 🤖 **Lan (AI & FE - 3 tasks: Chatbot Advanced & Menu UI)**
- [ ] **Task #48 [FE]**: UI Quản lý Lịch sử trò chuyện (Sidebar hiển thị các phiên chat cũ, click xem lại nội dung).
- [ ] **Task #50 [FE]**: UI Thông báo hết lượt chat thử cho khách vãng lai kèm nút chuyển hướng Đăng ký/Đăng nhập.
- [ ] **Task #41 [FE]**: UI Quản lý Thực đơn tuần (Bảng lịch 7 ngày trong tuần, các slot bữa ăn, thao tác thêm/xóa món ăn vào bữa).

#### 📋 **Khánh (BA & React FE - 6 tasks: Admin Portal & Restaurant Map)**
- [ ] **Task #33 [FE]**: Màn hình Admin: Quản lý Danh mục (Bảng danh mục, thêm/sửa/xóa, lọc theo loại).
- [ ] **Task #35 [FE]**: Màn hình Admin: Quản lý Thành viên (Bảng người dùng, thanh tìm kiếm, bộ lọc trạng thái, nút khóa tài khoản).
- [ ] **Task #37 [FE]**: Màn hình Admin: Hàng đợi kiểm duyệt bài viết & video (Xem nội dung, nút duyệt / ẩn bài).
- [ ] **Task #39 [FE]**: Màn hình Admin: Quản lý danh sách bình luận bị báo cáo & nút xóa bình luận.
- [ ] **Task #44 [FE]**: Màn hình Tra cứu Nhà hàng chay/healthy (Thẻ thông tin nhà hàng, lọc theo khu vực).
- [ ] **Task #46 [FE]**: Màn hình Bản đồ Nhà hàng (Xin quyền vị trí người dùng, hiển thị danh sách gần nhất trên giao diện Map).

---

### 4.3. Sprint 3: Lập Thực đơn Thông minh bằng AI & Đề xuất Nâng cao (Tasks #52 - #59)

#### 🤖 **Lan (AI & FE - 4 tasks: AI Planner Core & Smart Recommendation)**
- **Python AI Microservice:**
  - [ ] **Task #54 [AI]**: Xây dựng Pipeline sinh thực đơn tuần cá nhân hóa: Tiếp nhận chỉ số BMI, mục tiêu calo, danh sách nguyên liệu có sẵn, loại trừ nguyên liệu dị ứng -> Gọi LLM kết hợp ràng buộc dữ liệu món ăn -> Trả về cấu trúc JSON thực đơn 7 ngày.
  - [ ] **Task #57 [AI/Logic]**: Logic so khớp món ăn với thực đơn nhà hàng để gợi ý quán ăn tương ứng.
  - [ ] **Task #59 [AI/Logic]**: Logic phân tích độ tương đồng nội dung để gợi ý bài viết / video liên quan.
- **Frontend React:**
  - [ ] **Task #52 [FE]**: Màn hình Lập thực đơn AI (Form chọn mục tiêu dinh dưỡng, nhập nguyên liệu đang có sẵn trong tủ lạnh).
  - [ ] **Task #53 [FE]**: Màn hình Xem trước thực đơn AI gợi ý (Preview món ăn 7 ngày, nút đồng ý lưu vào Thực đơn tuần cá nhân).

#### ☕ **Thắng (BE - 2 tasks: Menu Persistence & Restaurant Recommendation API)**
- [ ] **Task #55 [BE]**: Viết API tiếp nhận kết quả từ AI của Lan để lưu chính thức vào bảng `weekly_menus` và `weekly_menu_items`. *(Blocked by #42, #43, #54)*
- [ ] **Task #57 [BE]**: API Gợi ý Nhà hàng (`GET /api/v1/restaurants/recommend?dishId=...`).

#### ☕ **Trường (BE - 2 tasks: Content Aggregation & Content Recommendation API)**
- [ ] **Task #13 & #15 [BE]**: Hoàn thiện API Trang chủ tổng hợp và API Tìm kiếm nâng cao nội dung (`GET /api/v1/home/latest`, `GET /api/v1/contents/search`).
- [ ] **Task #59 [BE]**: API Gợi ý Bài viết/Video liên quan (`GET /api/v1/contents/{id}/related`).

#### 📋 **Khánh (BA & React FE - 2 tasks: Recommendation UI Components)**
- [ ] **Task #56 [FE]**: Component Thẻ gợi ý nhà hàng phù hợp khi người dùng đang xem một món ăn cụ thể.
- [ ] **Task #58 [FE]**: Component Danh sách Bài viết / Video liên quan đặt tại trang chi tiết nội dung.

---

## 5. Quy chuẩn Đặt tên Phân nhánh Git & Quy tắc Phối hợp

Để đảm bảo không bao giờ xảy ra xung đột mã nguồn (Zero Git Conflicts):

1. **Phân nhánh nhánh tính năng (Feature Branching):**
   - Trường: `feature/be-auth-truong`, `feature/be-content-truong`, `feature/be-admin-truong`
   - Thắng: `feature/be-profile-thang`, `feature/be-menu-thang`, `feature/be-restaurant-thang`
   - Lan: `feature/ai-fastapi-lan`, `feature/fe-user-lan`, `feature/fe-planner-lan`
   - Khánh: `feature/fe-content-khanh`, `feature/fe-admin-khanh`, `feature/fe-restaurant-khanh`
2. **Quy tắc bảo vệ nhánh chính (`master` / `main`):**
   - Chỉ merge thông qua Pull Request (PR).
   - Trước khi merge, thành viên phải pull code mới nhất từ `origin/master` và rebase/merge vào nhánh cá nhân để kiểm tra build thành công (`mvn clean compile` hoặc `npm run build`).
3. **Thư mục dự án độc lập:**
   - Frontend: `frontend/` (Lan & Khánh)
   - Backend Spring Boot: `backend/` (Trường & Thắng)
   - AI Microservice: `ai-service/` (Lan)
