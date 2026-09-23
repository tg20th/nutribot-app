# NutriBot Full-Stack Master Implementation Plan (4 Members & Shared Deployment)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thiết lập kiến trúc repository dùng chung (Backend Spring Boot, Frontend React, AI Python FastAPI, CSDL MSSQL) cùng môi trường triển khai chung (`docker-compose.yml`, CORS, cấu hình môi trường), đồng thời phân rã các bước thực thi chi tiết cho cả 4 thành viên (Trường, Thắng, Lan, Khánh) để code và deploy song song không xung đột.

**Architecture:** Multi-service Monorepo gồm 3 dịch vụ kết nối CSDL trung tâm:
- `backend/` (Spring Boot 4.1.1, Java 25 - Port 8080)
- `frontend/` (React + Vite + TailwindCSS - Port 5173/3000)
- `ai-service/` (Python 3.11+ FastAPI - Port 8000)
- `sql-server` (Microsoft SQL Server 2022 - Port 1433, Database `NutriBotV2`)
Toàn bộ được điều phối triển khai thông qua `docker-compose.yml` và file biến môi trường dùng chung `.env`.

**Tech Stack:** Java 25, Spring Boot 4.1.1, Spring Security, JWT, Spring Data JPA, React 18/19, Vite, TailwindCSS, Axios, Python 3.11+, FastAPI, Uvicorn, LangChain / Google GenAI SDK, Microsoft SQL Server 2022, Docker & Docker Compose.

**Spec:** [`docs/superpowers/specs/2026-09-24-nutribot-backend-roadmap-design.md`](file:///C:/Users/PC/Documents/26FA/SWP391/Project/swp391_group7_nutribot/docs/superpowers/specs/2026-09-24-nutribot-backend-roadmap-design.md)

---

## Global Constraints & Deployment Rules

1. **Cấu trúc thư mục độc quyền (Directory Ownership):**
   - `backend/`: Do **Trường** và **Thắng** quản lý.
   - `frontend/`: Do **Khánh** và **Lan** quản lý.
   - `ai-service/`: Do **Lan** độc quyền quản lý.
   - Gốc repo (`docker-compose.yml`, `.env.example`, `README.md`): Cấu hình chung cho cả 4 thành viên.
2. **Quy tắc phân định cổng (Port Allocation):**
   - Frontend: `http://localhost:5173` (dev) hoặc `http://localhost:3000` (prod).
   - Backend API: `http://localhost:8080/api/v1/...`
   - AI Microservice: `http://localhost:8000/api/ai/...`
   - SQL Server: `localhost:1433`
3. **CORS Policy chung:**
   - Spring Boot và FastAPI phải luôn cấu hình CORS cho phép `http://localhost:5173` và `http://localhost:3000` gửi kèm Header `Authorization` và Credentials.
4. **Quy tắc Git Branching:**
   - Không ai commit trực tiếp lên `master`.
   - Mỗi thành viên làm việc trên branch riêng:
     - Trường: `feature/be-auth-truong`, `feature/be-content-truong`
     - Thắng: `feature/be-profile-thang`, `feature/be-menu-thang`
     - Lan: `feature/ai-fastapi-lan`, `feature/fe-user-lan`
     - Khánh: `feature/fe-content-khanh`, `feature/fe-admin-khanh`

---

## Review Focus

1. **Kết nối mạng giữa các container (Docker Network):** Khi chạy `docker-compose`, Spring Boot phải gọi sang AI service qua URL `http://ai-service:8000` thay vì `localhost:8000`.
2. **Đồng bộ Schema Database:** Không chạy `ddl-auto=create-drop` trên môi trường dùng chung; luôn dùng `ddl-auto=update` hoặc chạy script `backend/sql/Database.sql` khởi tạo trước.
3. **Mock Data Isolation:** Code Frontend của Khánh và Lan phải có cơ chế bật/tắt Mock Data (`VITE_USE_MOCK=true/false`) để khi BE chưa có API thì FE vẫn demo được, khi BE có API thì chuyển đổi trong 1 giây.
4. **Token Handling đồng nhất:** Frontend lưu JWT tại `localStorage.getItem('token')` và tự động gắn vào Header `Authorization: Bearer <token>` thông qua Axios Interceptor chung.
5. **Secret Keys:** Không bao giờ hardcode API Key (Gemini, JWT Secret, DB Password) vào code; luôn đọc từ Environment Variables (`.env`).

---

## Task Decomposition

### Task 0: Thiết lập Hạ tầng Triển khai Dùng chung (Docker Compose, Env, Monorepo Skeleton)

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `backend/Dockerfile`
- Create: `ai-service/Dockerfile`
- Create: `ai-service/requirements.txt`
- Create: `frontend/Dockerfile`

**Interfaces:**
- Produces: Môi trường chạy và deploy cho cả 4 thành viên bằng 1 lệnh duy nhất: `docker-compose up --build`.

- [ ] **Step 1: Tạo file biến môi trường mẫu `.env.example` tại thư mục gốc**

```properties
# Database
DB_HOST=sql-server
DB_PORT=1433
DB_NAME=NutriBotV2
DB_USER=sa
DB_PASSWORD=NutriBotSecurePass123!

# Backend Spring Boot
SPRING_PORT=8080
JWT_SECRET=404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970
JWT_EXPIRATION_MS=86400000
AI_SERVICE_URL=http://ai-service:8000

# AI Python Service
AI_PORT=8000
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Frontend React
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_USE_MOCK=false
```

- [ ] **Step 2: Tạo `docker-compose.yml` điều phối cả 4 service**

```yaml
version: '3.8'

services:
  sql-server:
    image: mcr.microsoft.com/mssql/server:2022-latest
    container_name: nutribot-sql-server
    environment:
      - ACCEPT_EULA=Y
      - MSSQL_SA_PASSWORD=${DB_PASSWORD:-NutriBotSecurePass123!}
      - MSSQL_PID=Developer
    ports:
      - "1433:1433"
    volumes:
      - mssql_data:/var/opt/mssql
      - ./backend/sql/Database.sql:/docker-entrypoint-initdb.d/Database.sql
    networks:
      - nutribot-network

  ai-service:
    build:
      context: ./ai-service
      dockerfile: Dockerfile
    container_name: nutribot-ai-service
    ports:
      - "8000:8000"
    environment:
      - PORT=8000
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    networks:
      - nutribot-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: nutribot-backend
    ports:
      - "8080:8080"
    depends_on:
      - sql-server
      - ai-service
    environment:
      - SPRING_DATASOURCE_URL=jdbc:sqlserver://sql-server:1433;databaseName=NutriBotV2;encrypt=true;trustServerCertificate=true
      - SPRING_DATASOURCE_USERNAME=${DB_USER:-sa}
      - SPRING_DATASOURCE_PASSWORD=${DB_PASSWORD:-NutriBotSecurePass123!}
      - NUTRIBOT_JWT_SECRET=${JWT_SECRET}
      - AI_SERVICE_URL=http://ai-service:8000
    networks:
      - nutribot-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: nutribot-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - nutribot-network

networks:
  nutribot-network:
    driver: bridge

volumes:
  mssql_data:
```

- [ ] **Step 3: Tạo Dockerfile cho từng service**

Tạo `backend/Dockerfile`:
```dockerfile
FROM eclipse-temurin:25-jdk-alpine AS builder
WORKDIR /app
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline
COPY src ./src
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Tạo `ai-service/Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Tạo `ai-service/requirements.txt`:
```txt
fastapi>=0.110.0
uvicorn>=0.28.0
pydantic>=2.6.0
google-generativeai>=0.4.0
python-dotenv>=1.0.0
httpx>=0.27.0
```

Tạo `frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 4: Commit hạ tầng triển khai chung**

```bash
git add docker-compose.yml .env.example backend/Dockerfile ai-service/Dockerfile ai-service/requirements.txt frontend/Dockerfile
git commit -m "chore(infra): setup unified docker-compose, env config and Dockerfiles for all 4 services"
```

---

### Task 1: Kế hoạch Triển khai cho TRƯỜNG (Backend: Auth, Security, Content & Admin)

**Thư mục làm việc:** `backend/src/main/java/com/fpt/swp391/nutribot/` (các package `config`, `entity`, `repository`, `service/impl`, `controller` liên quan đến User, Content, Admin).

- [ ] **Step 1: Tạo Entity & Repository cho `User`, `Role` (Task #3)**
  - File: `entity/Role.java`, `entity/User.java`
  - File: `repository/RoleRepository.java`, `repository/UserRepository.java`
  - Map đúng các trường trong bảng `users`: `user_id`, `username`, `email`, `password_hash`, `full_name`, `role_id`, `strike_count`, `status`.

- [ ] **Step 2: Cấu hình Spring Security & JWT (Task #5, #6)**
  - File: `config/JwtTokenProvider.java`: Hàm tạo token, lấy username, kiểm tra hạn token.
  - File: `config/JwtAuthenticationFilter.java`: Bắt header `Bearer <token>`, nạp vào `SecurityContext`.
  - File: `config/SecurityConfig.java`: Cho phép public `/api/v1/auth/**`, `/api/v1/blogs/**`, `/api/v1/videos/**`; phân quyền admin `/api/v1/admin/**`. Cấu hình CORS cho Frontend.

- [ ] **Step 3: Triển khai API Đăng ký & Đăng nhập (Task #2, #5)**
  - File: `dto/request/RegisterRequest.java`, `LoginRequest.java`
  - File: `dto/response/AuthResponse.java`
  - File: `service/AuthService.java` & `service/impl/AuthServiceImpl.java`: Validate email/username duy nhất, mã hóa BCrypt, kiểm tra trạng thái tài khoản `ACTIVE`/`SUSPENDED`.
  - File: `controller/AuthController.java`: Endpoint `POST /api/v1/auth/register`, `POST /api/v1/auth/login`.

- [ ] **Step 4: Triển khai Entity Content & API Blog/Video công khai (Task #17, #22)**
  - File: `entity/Content.java`: Map bảng `contents` (`content_id`, `user_id`, `content_type` ['BLOG' | 'VIDEO'], `title`, `slug`, `body`, `media_url`, `thumbnail_url`, `status`, `view_count`).
  - File: `repository/ContentRepository.java`: Các query tìm kiếm theo type, status = 'published', phân trang.
  - File: `service/ContentService.java` & `controller/ContentController.java`:
    - `GET /api/v1/blogs`: Danh sách blog đã duyệt kèm phân trang.
    - `GET /api/v1/blogs/{id}`: Chi tiết bài viết blog.
    - `GET /api/v1/videos`: Danh sách video nấu ăn.
    - `GET /api/v1/videos/{id}`: Chi tiết video.

- [ ] **Step 5: Triển khai API Tác giả Thêm/Sửa/Xóa Blog & Video (Task #19, #24)**
  - Cho phép người dùng có token tạo mới bài viết (`POST /api/v1/blogs`, `POST /api/v1/videos`).
  - Cập nhật bài viết của chính mình (`PUT /api/v1/blogs/{id}`).
  - Xóa bài viết của chính mình (`DELETE /api/v1/blogs/{id}`).

- [ ] **Step 6: Triển khai Bình luận & Like/Vote (Task #27, #28)**
  - File: `entity/Comment.java`, `entity/Vote.java`
  - `POST /api/v1/contents/{id}/comments`: Đăng bình luận.
  - `POST /api/v1/contents/{id}/vote`: Vote 1 hoặc -1; tự hủy vote nếu bấm lần 2; chống trùng vote.

- [ ] **Step 7: Triển khai Cổng Quản trị Admin (Task #36, #38, #40)**
  - File: `controller/AdminController.java`:
    - `GET /api/v1/admin/users`: Danh sách thành viên kèm tìm kiếm.
    - `PUT /api/v1/admin/users/{id}/status`: Khóa hoặc kích hoạt lại tài khoản.
    - `PUT /api/v1/admin/contents/{id}/status`: Duyệt, ẩn hoặc xóa bài viết vi phạm.
    - `DELETE /api/v1/admin/comments/{id}`: Xóa bình luận độc hại.

- [ ] **Step 8: Unit test & Commit của Trường**
  - Chạy `mvn test` đảm bảo pass.
  - Push lên branch `feature/be-auth-content-truong`.

---

### Task 2: Kế hoạch Triển khai cho THẮNG (Backend: Profile, Menu, Restaurant & AI Gateway)

**Thư mục làm việc:** `backend/src/main/java/com/fpt/swp391/nutribot/` (các package `entity`, `repository`, `service/impl`, `controller` liên quan đến Profile, Category, Menu, Restaurant, Chatbot).

- [ ] **Step 1: Tạo Entity & Repository Profile, Ingredient, Allergy (Task #11)**
  - File: `entity/UserProfile.java`, `entity/Ingredient.java`
  - File: `repository/UserProfileRepository.java`, `repository/IngredientRepository.java`
  - Quan hệ `@OneToOne` với `User` và `@ManyToMany` với `Ingredient` qua bảng `user_allergies`.

- [ ] **Step 2: Triển khai API Hồ sơ Dinh dưỡng & Tính BMI tự động (Task #8, #10)**
  - File: `dto/request/HealthProfileUpdateRequest.java`
  - File: `dto/response/UserProfileResponse.java`
  - File: `service/UserProfileService.java` & `controller/UserProfileController.java`:
    - `GET /api/v1/users/profile`: Lấy thông tin cá nhân và chỉ số sức khỏe.
    - `PUT /api/v1/users/profile/health`: Cập nhật chiều cao, cân nặng, danh sách ID dị ứng.
    - Thuật toán tự động: $BMI = \frac{weight\_kg}{(height\_m)^2}$, phân loại (Gầy, Bình thường, Thừa cân, Béo phì).

- [ ] **Step 3: Triển khai Entity Category & API Danh mục (Task #34)**
  - File: `entity/Category.java`: Bảng `categories` (`category_id`, `name`, `slug`, `category_type` ['INGREDIENT' | 'RECIPE']).
  - File: `controller/CategoryController.java`: CRUD danh mục (cung cấp danh mục cho bài viết của Trường và nguyên liệu của Thắng).

- [ ] **Step 4: Xây dựng Java Gateway kết nối AI Chatbot (Task #31)**
  - File: `config/AiServiceProperties.java`: Đọc cấu hình URL `AI_SERVICE_URL` (mặc định `http://localhost:8000`).
  - File: `service/ChatbotGatewayService.java`: Sử dụng `RestClient` hoặc `RestTemplate` gọi sang FastAPI của Lan:
    `POST http://localhost:8000/api/ai/chat` với body `{ "message": "...", "session_id": "..." }`.
  - Cơ chế Fallback: Nếu service AI của Lan chưa bật, trả về câu trả lời giả lập thân thiện để không làm lỗi app.

- [ ] **Step 5: Triển khai Lưu trữ Lịch sử Chat & Giới hạn Khách vãng lai (Task #49, #51)**
  - File: `entity/ChatSession.java`, `entity/ChatMessage.java`
  - `POST /api/v1/chatbot/query`: Nhận câu hỏi từ User/Khách -> Gửi sang Gateway AI -> Lưu câu hỏi & câu trả lời vào `chat_messages` -> Trả về client.
  - Quản lý khách vãng lai: Tối đa 3 câu hỏi (`trial_query_count <= 3`), vượt quá sẽ báo lỗi yêu cầu đăng nhập.
  - `GET /api/v1/chatbot/history`: Lấy toàn bộ lịch sử các đoạn chat cũ của tài khoản.

- [ ] **Step 6: Triển khai Thực đơn tuần (Weekly Menu) & Món ăn (Task #42, #43)**
  - File: `entity/Dish.java`, `entity/WeeklyMenu.java`, `entity/WeeklyMenuMeal.java`, `entity/WeeklyMenuItem.java`
  - `POST /api/v1/weekly-menus`: Tạo thực đơn tuần 7 ngày.
  - `POST /api/v1/weekly-menus/{id}/items`: Thêm món ăn vào bữa sáng/trưa/tối.
  - `DELETE /api/v1/weekly-menus/{id}/items/{itemId}`: Xóa món khỏi thực đơn.

- [ ] **Step 7: Triển khai Danh sách Nhà hàng & Định vị GPS (Task #45, #47)**
  - File: `entity/Restaurant.java`: Map bảng `restaurants` (tên, địa chỉ, latitude, longitude, phone, website).
  - `GET /api/v1/restaurants`: Danh sách nhà hàng chay/healthy.
  - `GET /api/v1/restaurants/nearby?lat=...&lng=...&radiusKm=5`:
    Áp dụng công thức khoảng cách Haversine trong SQL hoặc Java để lọc các quán ăn trong bán kính người dùng chọn.

- [ ] **Step 8: Unit test & Commit của Thắng**
  - Chạy `mvn test` đảm bảo pass.
  - Push lên branch `feature/be-profile-menu-thang`.

---

### Task 3: Kế hoạch Triển khai cho LAN (AI Python Service & AI/User React FE)

**Thư mục làm việc:** 
- AI: `ai-service/` (Python FastAPI)
- Frontend: `frontend/src/` (các trang Auth, Profile, Chatbot, Meal Planner)

#### **Phần A: AI Python Service (`ai-service/`)**
- [ ] **Step 1: Khởi tạo FastAPI App & Kết nối LLM (Task #32)**
  - File: `ai-service/main.py`:
    ```python
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel
    import os
    import google.generativeai as genai

    app = FastAPI(title="NutriBot AI Service")

    genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

    class ChatRequest(BaseModel):
        message: str
        session_id: str | None = None
        user_context: dict | None = None

    class ChatResponse(BaseModel):
        reply: str
        recommendations: list[str] = []

    SYSTEM_PROMPT = """Bạn là NutriBot, chuyên gia tư vấn dinh dưỡng thông minh chuyên về chế độ ăn thực vật, healthy và thực đơn khoa học.
    Hãy trả lời người dùng một cách ấm áp, cung cấp thông tin calo, dinh dưỡng chính xác và cảnh báo dị ứng rõ ràng."""

    @app.post("/api/ai/chat", response_model=ChatResponse)
    async def chat(req: ChatRequest):
        try:
            model = genai.GenerativeModel('gemini-1.5-flash', system_instruction=SYSTEM_PROMPT)
            response = model.generate_content(req.message)
            return ChatResponse(reply=response.text)
        except Exception as e:
            # Fallback nếu mất kết nối LLM
            return ChatResponse(reply="Chào bạn! Mình là NutriBot. Hiện kết nối AI đang bận, bạn hãy thử lại sau giây lát nhé!")
    ```

- [ ] **Step 2: Xây dựng Thuật toán Lập Thực đơn Thông minh (Task #54)**
  - File: `ai-service/planner.py`:
    - Nhận vào: `height_cm`, `weight_kg`, `bmi`, `health_goal` (giảm cân, giữ dáng), `allergies` (danh sách món dị ứng), `available_ingredients` (nguyên liệu trong tủ lạnh).
    - Tạo prompt chuyên sâu yêu cầu LLM trả về đúng JSON cấu trúc 7 ngày (Thứ 2 -> Chủ Nhật, mỗi ngày 3 bữa).
    - Endpoint: `POST /api/ai/generate-meal-plan`.

#### **Phần B: Frontend React (Lan)**
- [ ] **Step 3: Màn hình Đăng ký & Đăng nhập (Task #1, #4)**
  - File: `frontend/src/pages/RegisterPage.jsx`, `frontend/src/pages/LoginPage.jsx`
  - Xử lý submit gọi API `POST /api/v1/auth/login`, lưu token vào `localStorage`, chuyển hướng về trang chủ.

- [ ] **Step 4: Màn hình Hồ sơ Sức khỏe & Dị ứng (Task #7, #9)**
  - File: `frontend/src/pages/ProfilePage.jsx`
  - Form nhập chiều cao, cân nặng, mục tiêu sức khỏe; component chọn nhiều nguyên liệu dị ứng (multi-select tag); thanh đo chỉ số BMI trực quan (màu xanh/vàng/đỏ).

- [ ] **Step 5: Floating Chatbot Widget (Task #29, #30)**
  - File: `frontend/src/components/chatbot/ChatbotWidget.jsx`
  - Nút tròn cố định góc dưới phải màn hình; click mở cửa sổ chat; hiển thị danh sách tin nhắn bong bóng; ô nhập và nút gửi; kết nối API Java Backend `/api/v1/chatbot/query`.

- [ ] **Step 6: Màn hình Lập Thực đơn Tuần AI (Task #52, #53)**
  - File: `frontend/src/pages/MealPlannerPage.jsx`
  - Màn hình nhập nguyên liệu có sẵn -> Bấm "Tạo thực đơn" -> Hiển thị màn hình xem trước (Preview 7 ngày) -> Nút "Lưu vào thực đơn của tôi".

- [ ] **Step 7: Commit của Lan**
  - Push lên branch `feature/ai-and-user-fe-lan`.

---

### Task 4: Kế hoạch Triển khai cho KHÁNH (BA & React FE: Admin, Content, Restaurant)

**Thư mục làm việc:** `frontend/src/` (sử dụng AI sinh mã nguồn React cho các màn hình theo đúng đặc tả nghiệp vụ).

- [ ] **Step 1: Thiết lập Mock Data Provider cho Frontend**
  - File: `frontend/src/mock/mockData.js`:
    Chứa dữ liệu mẫu cho Blogs, Videos, Categories, Users, Restaurants để Khánh render và test giao diện ngay lập tức mà không cần chờ Backend.
  - File: `frontend/src/services/apiClient.js`: Cấu hình Axios Interceptor tự động gắn `Authorization: Bearer <token>`, tự động chuyển sang mock data nếu API BE trả về lỗi kết nối.

- [ ] **Step 2: Màn hình Danh sách & Chi tiết Blog (Task #16, #20)**
  - File: `frontend/src/pages/BlogListPage.jsx`: Lưới bài viết (Card ảnh bìa, tiêu đề, tác giả, lượt xem, phân trang).
  - File: `frontend/src/pages/BlogDetailPage.jsx`: Nội dung bài viết chi tiết, khối thông tin tác giả.
  - File: `frontend/src/pages/MyBlogsPage.jsx`: Bảng quản lý bài viết của tôi, nút sửa và nút xóa.

- [ ] **Step 3: Màn hình Danh sách & Chi tiết Video nấu ăn (Task #21, #25)**
  - File: `frontend/src/pages/VideoListPage.jsx`: Lưới video hướng dẫn nấu ăn.
  - File: `frontend/src/pages/VideoDetailPage.jsx`: Video Player (nhúng YouTube / video player), mô tả món ăn.
  - File: `frontend/src/pages/MyVideosPage.jsx`: Bảng quản lý video cá nhân.

- [ ] **Step 4: Form Đăng/Sửa Blog & Video (Task #18, #23)**
  - File: `frontend/src/components/content/BlogEditor.jsx`: Trình soạn thảo văn bản, upload ảnh thumbnail, chọn danh mục.
  - File: `frontend/src/components/content/VideoEditor.jsx`: Form nhập link video, tiêu đề, thời lượng.

- [ ] **Step 5: Khối Bình luận & Like/Vote (Task #26)**
  - File: `frontend/src/components/content/CommentSection.jsx`: Khung nhập bình luận, danh sách bình luận nhiều cấp (reply), nút Thích (Heart/Thumbs up) hiển thị số lượt like theo thời gian thực.

- [ ] **Step 6: Cổng Quản trị Admin Dashboard (Task #33, #35, #37, #39)**
  - File: `frontend/src/pages/admin/CategoryAdminPage.jsx`: Quản lý danh mục món ăn và nguyên liệu (thêm/sửa/xóa).
  - File: `frontend/src/pages/admin/UserAdminPage.jsx`: Bảng người dùng, tìm kiếm theo email/tên, nút khóa tài khoản vi phạm.
  - File: `frontend/src/pages/admin/ContentModerationPage.jsx`: Hàng đợi kiểm duyệt bài viết/video do thành viên đăng tải, nút Duyệt / Từ chối / Ẩn.
  - File: `frontend/src/pages/admin/CommentAdminPage.jsx`: Quản lý danh sách bình luận vi phạm và thao tác xóa.

- [ ] **Step 7: Màn hình Tra cứu Nhà hàng & Bản đồ GPS (Task #44, #46)**
  - File: `frontend/src/pages/RestaurantListPage.jsx`: Danh sách nhà hàng chay/healthy, bộ lọc khoảng cách và khu vực.
  - File: `frontend/src/pages/RestaurantMapPage.jsx`: Tích hợp Leaflet / Google Maps, nút "Tìm quanh đây" lấy tọa độ GPS người dùng và cắm cờ các quán ăn lân cận.

- [ ] **Step 8: Commit của Khánh**
  - Push lên branch `feature/fe-admin-content-khanh`.

---

### Task 5: Tích hợp Toàn hệ thống & Kiểm thử Triển khai (Full Integration & Deployment Test)

**Mục tiêu:** Cả 4 thành viên hoàn thành merge code vào `master` và kiểm thử hệ thống chạy hoàn chỉnh qua Docker.

- [ ] **Step 1: Tạo Pull Request và Kiểm tra Xung đột (Code Review Gate)**
  - Trường & Thắng merge các nhánh Backend vào `master` sau khi `mvn clean compile` thành công.
  - Lan & Khánh merge các nhánh Frontend và AI vào `master` sau khi `npm run build` thành công.
  - Đảm bảo 0 file bị conflict nhờ phân chia domain và cấu trúc thư mục rành mạch.

- [ ] **Step 2: Chạy kiểm thử tích hợp End-to-End bằng Docker Compose**
  - Chạy lệnh: `docker-compose up --build -d`
  - Kiểm tra trạng thái cả 4 container:
    ```bash
    docker-compose ps
    ```
    Yêu cầu: `nutribot-sql-server`, `nutribot-ai-service`, `nutribot-backend`, `nutribot-frontend` đều ở trạng thái `Up` (healthy).

- [ ] **Step 3: Kịch bản Kiểm thử Nghiệm thu Hệ thống (Acceptance Testing)**
  1. Mở trình duyệt tại `http://localhost:3000`: Giao diện React hiển thị mượt mà.
  2. Đăng ký tài khoản mới: Backend lưu vào CSDL SQL Server `NutriBotV2`, cấp phát token JWT.
  3. Cập nhật hồ sơ sức khỏe: Nhập chiều cao 170cm, cân nặng 65kg -> Hệ thống tự động tính ra BMI 22.49 (Bình thường).
  4. Mở widget Chatbot: Hỏi câu hỏi *"Gợi ý cho tôi bữa tối chay giàu đạm"* -> Backend gửi sang AI Service port 8000 -> AI trả về lời khuyên dinh dưỡng -> Cửa sổ chat hiển thị câu trả lời và lưu vào lịch sử DB.
  5. Đăng nhập quyền Admin: Truy cập màn hình quản trị của Khánh -> Dữ liệu thống kê và danh sách kiểm duyệt hiển thị chính xác.
