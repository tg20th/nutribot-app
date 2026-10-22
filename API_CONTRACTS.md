# NutriBot - Standard API Contracts & Mock Data Schema

> **Mục đích:** Đóng băng hợp đồng dữ liệu giữa Backend (Trường, Thắng), AI (Lan) và Frontend (Khánh, Lan).  
> **Quy tắc:** Tất cả API response thành công hay thất bại đều được bọc trong cấu trúc chuẩn `ApiResponse<T>`.

---

## 1. Cấu trúc Response Chuẩn (Unified API Response)

```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": {},
  "timestamp": "2026-09-24T08:30:00Z"
}
```

Nếu có lỗi (HTTP status 4xx, 5xx):
```json
{
  "success": false,
  "message": "Email hoặc mật khẩu không chính xác!",
  "data": null,
  "timestamp": "2026-09-24T08:30:00Z"
}
```

---

## 2. Authentication & User Profile (Trường & Thắng)

### 2.1. Đăng ký tài khoản
- **Endpoint:** `POST /api/v1/auth/register`
- **Request Body:**
```json
{
  "username": "hoanglan_ai",
  "email": "lan@nutribot.com",
  "password": "Password123@",
  "fullName": "Hoàng Thị Lan"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Đăng ký tài khoản thành công",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "hoanglan_ai",
    "role": "ROLE_USER"
  },
  "timestamp": "2026-09-24T08:30:00Z"
}
```

### 2.2. Đăng nhập
- **Endpoint:** `POST /api/v1/auth/login`
- **Request Body:**
```json
{
  "usernameOrEmail": "hoanglan_ai",
  "password": "Password123@"
}
```
- **Response (200 OK):** Giống response của Đăng ký.

### 2.3. Lấy thông tin cá nhân & Chỉ số Sức khỏe
- **Endpoint:** `GET /api/v1/users/profile`
- **Header:** `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "userId": 1,
    "username": "hoanglan_ai",
    "email": "lan@nutribot.com",
    "fullName": "Hoàng Thị Lan",
    "avatarUrl": "https://cdn.nutribot.vn/avatars/user-1.webp",
    "bio": "Yêu thích các món ăn lành mạnh và giàu đạm thực vật.",
    "heightCm": 165.0,
    "weightKg": 55.0,
    "bmi": 20.2,
    "bmiCategory": "Bình thường",
    "gender": "Nữ",
    "dateOfBirth": "2003-05-15",
    "healthGoal": "maintain",
    "allergies": ["Đậu phộng", "Sữa bò", "Hải sản"]
  },
  "timestamp": "2026-09-24T08:30:00Z"
}
```

### 2.4. Cập nhật thông tin cá nhân cơ bản
- **Endpoint:** `PUT /api/v1/users/profile`

- Request allowlist: `username`, `email`, `fullName`, `bio`, `gender`, `dateOfBirth`; `username` and `email` are required. Null/blank `fullName`, `bio`, and `gender` clear those fields; null `dateOfBirth` clears the date (a blank date string is invalid). Unknown fields such as `userId`, `role`, `status`, `strikeCount`, and passwords are ignored.
- `email` remains required for backward compatibility and is normalized to lowercase. If it differs from the current address, the API records it as pending and requests OTP delivery through the `EmailOtpSender` integration point. The current email stays active until the new address is verified; the pending address is not used for login or treated as trusted identity.
- An address already active on another account or pending verification for another account returns HTTP 409. The six-digit OTP expires after 30 minutes and is stored as a BCrypt hash. Verification requires the authenticated user and permits at most five attempts; an expired or exhausted request is invalidated, while the current email remains active.
- OTP delivery is not implemented in this task. Until an `EmailOtpSender` bean is provided by the OTP integration task, changed-email requests return HTTP 503 and are rolled back; no pending address is left behind.
- The target user comes only from the authenticated principal. Profile writes are serialized per user with last-write-wins behavior, and the `user_profiles.user_id` primary key enforces one profile per user.
- `users.avatar_url` and `users.bio` are canonical. Run [`backend/sql/migrations/NB-08-canonical-profile-fields.sql`](backend/sql/migrations/NB-08-canonical-profile-fields.sql) before deploying to an existing database; it copies legacy values where the canonical value is empty, then removes duplicate columns.

- **Header:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "username": "hoanglan_ai",
  "fullName": "Hoàng Thị Lan",
  "email": "lan@nutribot.com",
  "bio": "Yêu thích các món ăn lành mạnh và giàu đạm thực vật.",
  "gender": "Female",
  "dateOfBirth": "2003-05-15"
}
```
- **Response (200 OK):** Trả về `ApiResponse` chứa hồ sơ đã cập nhật.

- **Email verification:** Authenticated `POST /api/v1/users/profile/email/verify` accepts `{"otp":"123456"}` and returns the newly active email in `data.email`. The target account comes only from the JWT principal. OTP delivery is intentionally delegated to the future `EmailOtpSender` adapter.

### 2.5. Cập nhật hoặc xóa ảnh đại diện
- **Cập nhật:** `PUT /api/v1/users/profile/avatar`
- **Content-Type:** `multipart/form-data`
- **Form field:** `avatar` (JPG, PNG hoặc WebP; tối đa 5 MB)
- **Xóa:** `DELETE /api/v1/users/profile/avatar`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Cập nhật ảnh đại diện thành công",
  "data": {
    "avatarUrl": "https://cdn.nutribot.vn/avatars/user-1.webp"
  },
  "timestamp": "2026-09-25T10:00:00Z"
}
```

### 2.6. Cập nhật chỉ số cơ thể & Dị ứng (Tự động tính BMI)
- **Lấy hồ sơ sức khỏe:** `GET /api/v1/users/profile/health`
- **Cập nhật hồ sơ sức khỏe:** `PUT /api/v1/users/profile/health`
- **Header:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "heightCm": 168.0,
  "weightKg": 58.0,
  "healthGoal": "gain_muscle",
  "allergyIngredientIds": [2, 5]
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Cập nhật hồ sơ sức khỏe thành công",
  "data": {
    "heightCm": 168.0,
    "weightKg": 58.0,
    "bmi": 20.5,
    "bmiCategory": "Bình thường",
    "healthGoal": "gain_muscle",
    "allergyIngredientIds": [2, 5],
    "allergies": ["Hành tây", "Bắp cải"]
  },
  "timestamp": "2026-09-25T08:30:00Z"
}
```

### 2.7. Lấy danh sách nguyên liệu chọn dị ứng
- **Endpoint:** `GET /api/v1/ingredients`
- **Header:** `Authorization: Bearer <token>`
- **Mô tả:** Trả về các nguyên liệu đang hoạt động từ bảng `ingredients`, sắp xếp theo tên.

---

## 3. Quản lý Danh mục (Categories - Thắng)

- **Endpoint:** `GET /api/v1/categories?type=RECIPE` (hoặc `type=INGREDIENT`)
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "categoryId": 1,
      "name": "Món Chay Thanh Đạm",
      "slug": "mon-chay-thanh-dam",
      "categoryType": "RECIPE",
      "description": "Các món ăn thuần chay giàu vitamin"
    },
    {
      "categoryId": 2,
      "name": "Thực Phẩm Giàu Protein Thực Vật",
      "slug": "protein-thuc-vat",
      "categoryType": "INGREDIENT",
      "description": "Các loại hạt và đậu"
    }
  ]
}
```

---

## 4. Nội dung Blog & Video (Trường & Khánh)

### 4.1. Danh sách bài viết Blog công khai
- **Endpoint:** `GET /api/v1/blogs?page=0&size=10&categoryId=1`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "content": [
      {
        "contentId": 101,
        "title": "7 Ngày Ăn Chay Thanh Lọc Cơ Thể",
        "slug": "7-ngay-an-chay-thanh-loc-co-the",
        "thumbnailUrl": "https://images.unsplash.com/photo-1540420773420-3366772f4999",
        "authorName": "Nguyễn Văn Trường",
        "viewCount": 1250,
        "voteCount": 89,
        "createdAt": "2026-09-20T10:00:00Z"
      }
    ],
    "totalElements": 25,
    "totalPages": 3,
    "currentPage": 0
  }
}
```

### 4.2. Chi tiết bài viết Blog
- **Endpoint:** `GET /api/v1/blogs/{id}`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "contentId": 101,
    "title": "7 Ngày Ăn Chay Thanh Lọc Cơ Thể",
    "body": "Nội dung bài viết chi tiết định dạng Markdown hoặc HTML...",
    "thumbnailUrl": "https://images.unsplash.com/photo-1540420773420-3366772f4999",
    "authorId": 1,
    "authorName": "Nguyễn Văn Trường",
    "viewCount": 1251,
    "voteCount": 89,
    "userVoted": 1,
    "createdAt": "2026-09-20T10:00:00Z"
  }
}
```

### 4.3. Bình luận bài viết
- **Endpoint:** `POST /api/v1/contents/{contentId}/comments`
- **Request Body:**
```json
{
  "body": "Bài viết rất hữu ích cho người mới bắt đầu ăn chay!",
  "parentId": null
}
```

---

## 5. Thực đơn tuần (Weekly Menu - Thắng & Lan)

Các endpoint bên dưới yêu cầu Bearer token. Menu chỉ được đọc/cập nhật bởi user sở hữu menu. `dayOfWeek` dùng số 1–7 (Thứ Hai–Chủ Nhật), `mealType` nhận `breakfast`, `lunch`, `dinner`, `snack`.

### 5.1. Tải danh mục món ăn
- **Endpoint:** `GET /api/v1/dishes`
- Chỉ trả món đang hoạt động và có dữ liệu calo.
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": [
    { "dishId": 5, "name": "Yến mạch hoa quả hạt chia", "calories": 350, "proteinG": 12.5, "carbsG": 45.0, "healthyFatsG": 10.0, "imageUrl": "https://example.com/oats.jpg" }
  ],
  "timestamp": "2026-09-27T12:00:00Z"
}
```

### 5.2. Tải thực đơn của một tuần
- **Endpoint:** `GET /api/v1/weekly-menus/current?startDate=2026-09-21`
- `startDate` không bắt buộc; mặc định là Thứ Hai của tuần hiện tại. Nếu chưa có menu, trả cấu trúc rỗng với tổng calo ngày/tuần bằng 0.
- Mỗi `totalCalories` của món là `calories × servings`, làm tròn đến số nguyên gần nhất. `dailyTotals` và `totalCalories` là tổng của các món trong menu.
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "menuId": 1,
    "startDate": "2026-09-21",
    "endDate": "2026-09-27",
    "targetCalories": 1800,
    "status": "saved",
    "meals": [
      {
        "mealId": 10,
        "dayOfWeek": 1,
        "mealType": "breakfast",
        "items": [
          {
            "itemId": 101,
            "dishId": 5,
            "dishName": "Yến mạch hoa quả hạt chia",
            "calories": 350,
            "proteinG": 12.5,
            "carbsG": 45.0,
            "healthyFatsG": 10.0,
            "imageUrl": "https://example.com/oats.jpg",
            "servings": 1.0,
            "notes": "Ăn kèm sữa hạnh nhân",
            "totalCalories": 350,
            "totalCarbsG": 45.0,
            "totalHealthyFatsG": 10.0
          }
        ]
      }
    ],
    "dailyTotals": [
      { "dayOfWeek": 1, "totalCalories": 350 },
      { "dayOfWeek": 2, "totalCalories": 0 },
      { "dayOfWeek": 3, "totalCalories": 0 },
      { "dayOfWeek": 4, "totalCalories": 0 },
      { "dayOfWeek": 5, "totalCalories": 0 },
      { "dayOfWeek": 6, "totalCalories": 0 },
      { "dayOfWeek": 7, "totalCalories": 0 }
    ],
    "totalCalories": 350,
    "nutritionSummary": {
      "status": "AVAILABLE",
      "actual": { "calories": 350, "proteinG": 12.5, "carbsG": 45.0, "healthyFatsG": 10.0 },
      "target": { "calories": 12600, "proteinG": 630, "carbsG": 1575, "healthyFatsG": 350 },
      "percentage": { "calories": 2.8, "proteinG": 2.0, "carbsG": 2.9, "healthyFatsG": 2.9 },
      "missingFields": []
    }
  },
  "timestamp": "2026-09-27T12:00:00Z"
}
```
- `nutritionSummary` trả **phẳng** (không lồng `summary`): `actual` là **tổng cả tuần**, `target` là mục tiêu **nhân 7** (tuần) tính từ Health Profile, `percentage` = `actual / target × 100`.
- `status`: `AVAILABLE` (đủ 4 chỉ số), `PARTIAL` (thiếu macro do món chưa có dữ liệu), `EMPTY_MENU`, `PROFILE_INCOMPLETE` (thiếu hồ sơ — khi đó `target`/`percentage` là `null` và `missingFields` liệt kê field thiếu).

### 5.3. Tạo thực đơn tuần
- **Endpoint:** `POST /api/v1/weekly-menus` (201 Created)
- `endDate` phải đúng 6 ngày sau `startDate`; trạng thái mới tạo là `initialized`.
- **Request Body:**
```json
{
  "title": "Meal plan · Sep 21 - 27, 2026",
  "startDate": "2026-09-21",
  "endDate": "2026-09-27",
  "targetCalories": 1800,
  "dietaryGoal": "balanced"
}
```

### 5.3a. Lưu thực đơn do AI tạo
- **Endpoint:** `POST /api/v1/weekly-menus/ai-generated` (200 OK, yêu cầu Bearer token)
- `startDate` phải là Thứ Hai. `generatedMenu.weeklyPlan` có đúng 7 ngày theo thứ tự Thứ Hai đến Chủ Nhật, mỗi ngày có đủ `breakfast`, `lunch`, `dinner`.
- Mỗi bữa phải có `dishId` tham chiếu món đang hoạt động, có calo trong cơ sở dữ liệu và `servings` từ 0.01 đến 99.99. Tên và dữ liệu dinh dưỡng từ AI chỉ dùng để hiển thị; dữ liệu lưu được xác thực/đọc lại từ món trong database.
- Lưu lại cùng tuần của user sẽ thay thế nội dung tuần hiện có trong một transaction. User được xác định từ Bearer token.
- **Request Body:**
```json
{
  "startDate": "2026-09-21",
  "dietaryGoal": "balanced",
  "generatedMenu": {
    "suggestedMenuTitle": "Balanced weekly menu",
    "estimatedDailyCalories": 1800,
    "weeklyPlan": [
      {
        "day": "Monday",
        "breakfast": { "dishId": 5, "servings": 1.0 },
        "lunch": { "dishId": 8, "servings": 1.0 },
        "dinner": { "dishId": 11, "servings": 1.0 }
      }
    ]
  }
}
```
- `weeklyPlan` trong ví dụ cần có đủ 7 phần tử khi gọi thật.

### 5.4. Thêm món vào bữa
- **Endpoint:** `POST /api/v1/weekly-menus/{menuId}/items` (201 Created)
- Món phải đang hoạt động và có calo; số suất phải lớn hơn 0. Không thể thêm cùng một món hai lần vào cùng một bữa.
- **Request Body:**
```json
{
  "dayOfWeek": 1,
  "mealType": "breakfast",
  "dishId": 5,
  "servings": 1.0,
  "notes": "Ăn kèm sữa hạnh nhân"
}
```

### 5.5. Thay thế nội dung thực đơn tuần
- **Endpoint:** `PUT /api/v1/weekly-menus/{menuId}` (200 OK)
- PUT thay thế toàn bộ metadata và danh sách món hiện có. `meals` là danh sách phẳng; mỗi dòng xác định ngày, bữa và món. Gửi `meals: []` để xóa toàn bộ món trong menu.
- Mọi món và dữ liệu ngày phải hợp lệ trước khi thay đổi được lưu. Sau khi lưu, trạng thái menu là `saved`.
- **Request Body:**
```json
{
  "title": "Meal plan · Sep 21 - 27, 2026",
  "startDate": "2026-09-21",
  "endDate": "2026-09-27",
  "targetCalories": 1800,
  "dietaryGoal": "balanced",
  "meals": [
    { "dayOfWeek": 1, "mealType": "breakfast", "dishId": 5, "servings": 1.0, "notes": "Oats" }
  ]
}
```

### 5.6. Xóa món khỏi thực đơn
- **Endpoint:** `DELETE /api/v1/weekly-menus/{menuId}/items/{itemId}` (204 No Content)
- Chỉ xóa món khỏi menu của user đang đăng nhập; bản ghi món ăn trong danh mục không bị xóa.

---

## 6. AI Nutrition Chatbot (Lan & Thắng)

### 6.1. Giao thức nội bộ (Spring Boot -> Python FastAPI)
- **URL nội bộ:** `POST http://ai-service:8000/api/ai/chat`
- **Request Body:**
```json
{
  "message": "Tôi bị dị ứng đậu phộng, tôi có thể thay thế bằng gì khi làm sốt salad?",
  "session_id": "session-1234",
  "user_context": {
    "bmi": 20.2,
    "allergies": ["Đậu phộng"]
  }
}
```
- **Response từ Python FastAPI:**
```json
{
  "reply": "Chào bạn! Bạn hoàn toàn có thể thay thế đậu phộng bằng bơ mè (tahini), hạt hướng dương xay nhuyễn hoặc sốt hạt điều để giữ được độ béo ngậy mà hoàn toàn an toàn cho người dị ứng đậu phộng nhé!",
  "recommendations": ["Sốt mè rang thuần chay", "Salad bơ hạt điều"]
}
```

### 6.2. Giao thức Client (React FE -> Spring Boot Gateway)
- **Endpoint:** `POST /api/v1/chatbot/query`
- **Header:** `Authorization: Bearer <token>` (tùy chọn nếu là khách)
- **Request Body:**
```json
{
  "sessionId": "guest-session-uuid",
  "message": "Tôi bị dị ứng đậu phộng, tôi có thể thay thế bằng gì khi làm sốt salad?",
  "conversationHistory": []
}
```
- Guest gửi `sessionId` ổn định để áp dụng quota 3 lượt; guest không tạo session hoặc lưu tin nhắn. Thành viên gửi session ID số, hoặc bỏ qua để tạo session mới. Lịch sử và hồ sơ sức khỏe của thành viên được lấy từ database.
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "sessionId": null,
    "senderType": "ASSISTANT",
    "content": "Chào bạn! Bạn hoàn toàn có thể thay thế đậu phộng bằng bơ mè (tahini)...",
    "createdAt": null,
    "reply": "Chào bạn! Bạn hoàn toàn có thể thay thế đậu phộng bằng bơ mè (tahini)...",
    "recommendations": ["Sốt mè rang thuần chay", "Salad bơ hạt điều"],
    "remainingTrialCount": 2,
    "fallback": false
  }
}
```
- Guest response có `sessionId` và `createdAt` là `null`; member response có ID session và thời gian lưu. Khi AI tạm thời không sẵn sàng, gateway trả fallback với `fallback: true` và không trừ quota guest.

---

## 7. AI Meal Planner (Sinh Thực Đơn Bằng AI - Lan & Thắng)

### 7.0. Giao thức nội bộ Spring Boot → FastAPI (NB-54)

- **URL nội bộ:** `POST http://ai-service:8000/api/ai/generate-meal-plan`
- API public ở mục 7.1 luôn đi qua Spring Boot; trình duyệt không gọi FastAPI trực tiếp.
- FastAPI dùng **planner tất định (OR-Tools CP-SAT)** — không gọi Gemini, không lưu dữ liệu. Spring Boot chuyển payload camelCase (`DeterministicPlannerRequest`) gồm chế độ ăn, ID nguyên liệu dị ứng, mục tiêu dinh dưỡng và danh mục món canonical:

```json
{
  "vegetarianType": "LACTO_OVO",
  "allergyIngredientIds": [12, 34],
  "nutritionTarget": { "calories": 1800, "proteinG": 90, "carbsG": 210, "fatG": 60, "estimated": true },
  "canonicalDishes": [
    {
      "dishId": 5, "name": "Yến mạch hoa quả", "description": null,
      "imageUrl": "https://example.com/oats.jpg", "categoryId": 2,
      "servingSize": 100, "servingUnit": "g",
      "calories": 350, "proteinG": 12.5, "carbsG": 45, "healthyFatsG": 10,
      "vegetarianType": "LACTO_OVO", "isActive": true,
      "ingredients": [ { "ingredientId": 3, "name": "Yến mạch" } ]
    }
  ]
}
```

- Planner chọn `dishId` duy nhất thuộc `canonicalDishes` sao cho **mỗi ngày** calo ±10% và protein/carbs/fat ±20% so với `nutritionTarget` (mục tiêu **hàng ngày**), kèm ràng buộc lặp món, đa dạng món và lọc dị ứng/chế độ ăn trước khi giải. Catalog demo (60 món) không thỏa mọi mục tiêu ở ngưỡng chặt này, nên service thử lần lượt 3 cấp độ nới lỏng: ±10/±20% (distinct 14, lặp ≤2/tuần) → ±15/±30% (distinct 10, lặp ≤3) → ±20/±40% (distinct 8, lặp ≤4); chỉ trả `INFEASIBLE` khi cả 3 cấp đều bất khả thi. Khi dùng cấp nới lỏng, response đánh dấu `executionMetadata.policyRelaxed: true`.
- **Response của FastAPI:**
```json
{
  "status": "OPTIMAL",
  "days": [
    {
      "day": "MONDAY",
      "meals": [ { "slot": "BREAKFAST", "dishId": 5 }, { "slot": "LUNCH", "dishId": 8 }, { "slot": "DINNER", "dishId": 12 } ],
      "nutritionTotal": { "calories": 1780, "proteinG": 91, "carbsG": 205, "fatG": 59 },
      "deviation": { "calories": -20, "proteinG": 1, "carbsG": -5, "fatG": -1 }
    }
  ],
  "weeklySummary": { "distinctDishCount": 14, "dishUsageCounts": { "5": 2 } },
  "reasonCodes": [],
  "executionMetadata": { "plannerVersion": "v1", "contractVersion": "v2", "greedyHintUsed": true, "policyRelaxed": false }
}
```
- Trạng thái khác: `INFEASIBLE`, `TIME_LIMIT_REACHED`, `VALIDATION_FAILED`, `INVALID_INPUT` (kèm `reasonCodes`). `executionMetadata` là thông tin chẩn đoán tùy chọn, tích hợp không bắt buộc.
- Spring Boot chỉ giữ `days[].day` + `meals[].slot/dishId`, xác minh ID lần nữa rồi bổ sung `dishName`, `calories`, `proteinG`, `carbsG`, `healthyFatsG`, `imageUrl` chính thức từ DB (dùng lại `nutritionTarget` đã tính) trước khi trả preview theo `ApiResponse<T>`.
- `weeklyPlan` luôn dùng nhãn tiếng Anh theo đúng thứ tự Monday đến Sunday; thứ tự này được dùng để gán ngày khi lưu menu.

### 7.1. API public

- **Endpoint:** `POST /api/v1/meal-planner/generate`
- **Request Body:**
```json
{
  "vegetarianType": "LACTO_OVO",
  "excludedAllergies": ["đậu phộng"]
}
```
- Các field tùy chọn khác (`healthGoal`, `availableIngredients`, `nutritionTarget`) vẫn được DTO chấp nhận nhưng planner hiện **không sử dụng**: mục tiêu dinh dưỡng luôn được Backend tính lại từ Health Profile (`NutritionTargetService`), còn `excludedAllergies` được đối chiếu sang ID nguyên liệu (tên không khớp danh mục sẽ bị bỏ qua).
- **Response (200 OK - Kế hoạch 7 ngày xem trước):**
```json
{
  "success": true,
  "message": "AI đã tạo thực đơn thành công",
  "data": {
    "suggestedMenuTitle": "Thực đơn tuần lacto-ovo",
    "estimatedDailyCalories": 1800,
    "nutritionTarget": { "estimated": true, "calories": 1800, "proteinG": 90, "carbsG": 210, "healthyFatsG": 60 },
    "weeklyPlan": [
      {
        "day": "Monday",
        "breakfast": { "dishId": 5, "dishName": "Yến mạch hoa quả", "calories": 350, "proteinG": 12.5, "carbsG": 45, "healthyFatsG": 10, "imageUrl": "https://example.com/oats.jpg", "servings": 1 },
        "lunch": { "dishId": 8, "dishName": "Đậu phụ sốt cà chua", "calories": 420, "proteinG": 24, "carbsG": 30, "healthyFatsG": 18, "imageUrl": "https://example.com/tofu.jpg", "servings": 1 },
        "dinner": { "dishId": 12, "dishName": "Canh rau củ", "calories": 300, "proteinG": 9, "carbsG": 28, "healthyFatsG": 8, "imageUrl": "https://example.com/soup.jpg", "servings": 1 }
      }
    ]
  }
}
```
- `nutritionTarget` là mục tiêu **hàng ngày** do Backend tính từ Health Profile; Frontend hiển thị nó trong preview để đối chiếu với trung bình 7 ngày của `weeklyPlan`.

---

## 8. Nhà hàng & Bản đồ GPS (Thắng & Khánh)

- **Endpoint:** `GET /api/v1/restaurants/nearby?lat=10.7769&lng=106.7009&radiusKm=3`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "restaurantId": 1,
      "name": "Nhà Hàng Chay Mãn Tự",
      "address": "201 Nguyễn Thị Minh Khai, Quận 1, TP.HCM",
      "latitude": 10.7712,
      "longitude": 106.6954,
      "distanceKm": 0.85,
      "phone": "02839251234",
      "website": "https://mantuvegan.vn"
    }
  ]
}
```

---

## 9. Thông báo (Notifications - Thắng & Lan)

> Phạm vi: NB-81 (duyệt / từ chối công thức) + NB-83 (vote / comment bài viết) + NB-84 (nội dung thông báo duyệt công thức).
> Tất cả endpoint yêu cầu token hợp lệ: `Authorization: Bearer <token>`.

### 9.1. Lấy danh sách thông báo

- **Endpoint:** `GET /api/v1/notifications?page=0&size=10`
- **Query Params:** `page` (mặc định `0`), `size` (mặc định `10`, tối đa `50`)
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Lấy danh sách thông báo thành công",
  "data": {
    "content": [
      {
        "notificationId": 12,
        "type": "CONTENT_VOTED",
        "referenceType": "CONTENT",
        "referenceId": 35,
        "actorId": 3,
        "actorFullName": "Jennie Kim",
        "actorAvatarUrl": "https://example.com/avatar.jpg",
        "title": "Công thức đã được thêm vào NutriBot",
        "message": "Công thức \"Phở nấm thuần chay\" từ bài viết \"Chia sẻ cách làm Phở nấm thuần chay\" của bạn đã được duyệt và thêm vào hệ thống. Bạn có thể tìm món này trong danh mục món ăn.",
        "actionUrl": "/community/posts/82",
        "contentTitle": "Cách làm Phở nữa thật ngon",
        "contentType": "BLOG",
        "read": false,
        "readAt": null,
        "createdAt": "2026-10-21T10:00:00",
        "updatedAt": "2026-10-21T10:12:30"
      }
    ],
    "page": 0,
    "size": 10,
    "totalElements": 1,
    "totalPages": 1,
    "first": true,
    "last": true,
    "currentPage": 0
  },
  "timestamp": "2026-10-21T10:15:00Z"
}
```

**Ý nghĩa các trường bổ sung (NB-83):**

| Trường | Ý nghĩa |
|---|---|
| `contentTitle` | Tiêu đề bài viết được vote / comment. `null` với thông báo duyệt công thức (NB-81) hoặc khi bài viết đã bị xoá. |
| `contentType` | Loại bài viết: `BLOG` hoặc `VIDEO` (viết hoa, khớp `contents.content_type`). `null` cùng trường hợp với `contentTitle`. |
| `updatedAt` | Thời điểm tương tác gần nhất. Khi có vote mới được gom vào thông báo cũ, `updatedAt` được cập nhật, thông báo đó **lên đầu danh sách** và được đánh dấu chưa đọc lại. |

- **Sắp xếp:** `updatedAt` giảm dần (mới nhất trước), tie-break theo `createdAt` rồi `notificationId` giảm dần.
- **Điều hướng (Frontend):** dùng `referenceId` (contentId) + `contentType` để gọi `GET /api/v1/blogs/id/{id}` hoặc `GET /api/v1/videos/id/{id}`.

### 9.2. Đếm số thông báo chưa đọc

- **Endpoint:** `GET /api/v1/notifications/unread-count`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Lấy số thông báo chưa đọc thành công",
  "data": 3,
  "timestamp": "2026-10-21T10:15:00Z"
}
```

### 9.3. Đánh dấu một thông báo đã đọc

- **Endpoint:** `PATCH /api/v1/notifications/{notificationId}/read`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Đánh dấu đã đọc thành công",
  "data": null,
  "timestamp": "2026-10-21T10:15:00Z"
}
```
- **Lỗi (404):** thông báo không tồn tại hoặc không thuộc về người đang đăng nhập.

### 9.4. Đánh dấu tất cả thông báo đã đọc

- **Endpoint:** `PATCH /api/v1/notifications/read-all`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Đánh dấu tất cả đã đọc thành công",
  "data": null,
  "timestamp": "2026-10-21T10:15:00Z"
}
```

### 9.5. Quy tắc sinh thông báo

| `type` | `referenceType` | `referenceId` | Sinh ra khi | Nguồn |
|---|---|---|---|---|
| `CONTENT_VOTED` | `CONTENT` | `contentId` | Có người khác vote bài viết của tôi | NB-83 |
| `CONTENT_COMMENTED` | `CONTENT` | `contentId` | Có người khác comment bài viết của tôi | NB-83 |
| `RECIPE_SUGGESTION_APPROVED` | `CONTENT_RECIPE_SUGGESTION` | `suggestionId` | Admin duyệt công thức tôi đề xuất | NB-81 |
| `RECIPE_SUGGESTION_REJECTED` | `CONTENT_RECIPE_SUGGESTION` | `suggestionId` | Admin từ chối công thức tôi đề xuất **hoặc** đề xuất bị đóng tự động do gỡ đồng thuận | NB-81 / NB-84 |

**Quy tắc NB-83:**
- Không tạo thông báo khi người dùng tự vote / tự comment bài của chính mình.
- Không tạo thông báo khi bỏ vote (`unvote`).
- Các vote gần nhau (trong cửa sổ **30 phút**) được **gộp vào cùng một thông báo** để tránh spam: `updatedAt` được cập nhật và `readAt` bị xoá để thông báo lên đầu danh sách và tính vào số chưa đọc.
- Mỗi comment tạo một thông báo riêng (không gộp).

### 9.6. Trường nội dung thông báo (NB-84)

Từ NB-84, mọi thông báo đều mang **tiêu đề + nội dung + đường dẫn điều hướng** để Frontend hiển thị được ngay, không cần tự dựng chuỗi.

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `title` | `string` (≤ 200 ký tự) | Tiêu đề thông báo. Với duyệt công thức: `Công thức đã được thêm vào NutriBot` / `Đề xuất công thức chưa được duyệt` / `Đề xuất công thức đã được đóng`. |
| `message` | `string` (≤ 1000 ký tự) | Nội dung chi tiết, có nêu tên món, tiêu đề bài viết và lý do (nếu có). |
| `actionUrl` | `string` (≤ 300 ký tự) | Đường dẫn FE điều hướng, dạng `/community/posts/{contentId}`. `null` khi không xác định được bài viết. |

**Quy tắc NB-84:**
- Thông báo duyệt công thức chỉ gửi cho **tác giả của bài viết** (người đã bật đồng thuận dùng công thức).
- `RECIPE_SUGGESTION_APPROVED` → thông báo chỉ được gửi **sau khi** công thức đã được import thành công vào danh mục món ăn.
- `RECIPE_SUGGESTION_REJECTED` sinh ra ở **hai** trường hợp, phân biệt qua `title`:
  - `Đề xuất công thức chưa được duyệt` → admin từ chối, `message` kèm `rejectionReason`.
  - `Đề xuất công thức đã được đóng` → đề xuất bị đóng tự động vì bài viết không còn đồng thuận dùng công thức (`message` kèm lý do gỡ đồng thuận).
- Không có thông báo riêng cho bước "đã gửi đề xuất" — tác giả tự theo dõi qua API mục 10.

## 10. Vòng đời đề xuất công thức (Recipe Suggestion Approval - NB-84)

> Phạm vi: NB-84 (Thắng). Tất cả endpoint yêu cầu token hợp lệ: `Authorization: Bearer <token>`.

### 10.1. Vòng đời và quy tắc nghiệp vụ

```text
Tác giả bật đồng thuận (recipeConsent = true)
        │
        ▼
Đủ điều kiện: published + (BLOG|VIDEO) + view ≥ 500 + vote ≥ 10
        │
        ▼
Hệ thống tạo đề xuất công thức  ──► status = PENDING   (+ ghi nhật ký SUGGESTED)
        │
        ├── Admin duyệt (APPROVE) ──► status = APPROVED  (+ nhật ký APPROVED)
        │     └── import món ăn + công thức, gửi thông báo RECIPE_SUGGESTION_APPROVED
        ├── Admin từ chối (REJECT) ─► status = REJECTED  (+ nhật ký REJECTED)
        │     └── gửi thông báo RECIPE_SUGGESTION_REJECTED kèm lý do
        └── Tác giả gỡ đồng thuận (true → false) ─► status = REJECTED (+ nhật ký AUTO_REJECTED)
              └── gửi thông báo RECIPE_SUGGESTION_REJECTED (title "Đề xuất công thức đã được đóng")
```

**Quy tắc:**
- Chỉ tồn tại 3 trạng thái: `PENDING` → `APPROVED` | `REJECTED`. Không thêm trạng thái mới.
- **Chỉ một đề xuất "đang hoạt động" (`PENDING` hoặc `APPROVED`) cho mỗi bài viết** — ràng buộc bởi unique index `UQ_content_recipe_suggestions_active` trên `contents`.
- Đề xuất chỉ được tạo khi bài viết **đang bật** `recipeConsent`.
- Khi admin duyệt, hệ thống kiểm tra lại `recipeConsent` lần cuối; nếu tác giả đã gỡ đồng thuận thì không duyệt được.
- Đồng thuận hợp lệ để duyệt (NB-87) phải đồng thời có `recipe_consent = 1`, `recipe_consent_at` khác `NULL` và `recipe_consent_terms_version` đúng phiên bản hiện hành (`v1`). Thiếu consent/mốc thời gian trả `400`; sai phiên bản điều khoản trả `409`. Xem mục 12.
- Rút đồng thuận làm mọi đề xuất `PENDING` của bài viết chuyển sang `REJECTED` kèm lý do `Tác giả đã gỡ đồng thuận dùng công thức cho bài viết này`.
- Job quét định kỳ (`app.content-recipe-suggestion.revocation-sweep-interval-ms`, mặc định 10 phút) đóng các đề xuất `PENDING` còn sót do bài viết mất đồng thuận ở nơi khác.

### 10.2. Tác giả theo dõi đề xuất của bài viết của mình

- **Endpoint:** `GET /api/v1/author/recipe-suggestions?status=PENDING&page=0&size=10`
- **Query Params:** `status` (tuỳ chọn: `PENDING` | `APPROVED` | `REJECTED`), `page` (mặc định `0`), `size` (mặc định `10`)
- **Quyền:** chỉ trả về đề xuất thuộc về **chính người đang đăng nhập**.
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Lấy danh sách đề xuất công thức thành công",
  "data": {
    "content": [
      {
        "suggestionId": 700,
        "status": "PENDING",
        "dishName": "Phở nấm thuần chay",
        "recipeTitle": "Phở nấm thuần chay",
        "contentId": 82,
        "contentTitle": "Chia sẻ cách làm Phở nấm thuần chay",
        "contentType": "BLOG",
        "sourceViewCount": 1800,
        "sourceVoteCount": 120,
        "rejectionReason": null,
        "reviewedBy": null,
        "reviewedByName": null,
        "reviewedAt": null,
        "createdAt": "2026-10-22T09:00:00",
        "updatedAt": "2026-10-22T09:00:00"
      }
    ],
    "page": 0,
    "size": 10,
    "totalElements": 1,
    "totalPages": 1,
    "first": true,
    "last": true,
    "currentPage": 0
  },
  "timestamp": "2026-10-22T09:30:00Z"
}
```

- **Lỗi (404):** đề xuất không tồn tại **hoặc không thuộc về** người đang đăng nhập (`Không tìm thấy đề xuất với ID: {id}`) — trả 404 để không lộ sự tồn tại của đề xuất của người khác.

### 10.3. Chi tiết một đề xuất của tác giả

- **Endpoint:** `GET /api/v1/author/recipe-suggestions/{suggestionId}`
- **Response (200 OK):** trả về **một object** `AuthorRecipeSuggestionResponse` (cùng cấu trúc phần tử ở mục 10.2).
- **Lỗi (404):** xem mục 10.2.

### 10.4. Admin xem nhật ký đề xuất

- **Endpoint:** `GET /api/v1/admin/content-recipe-suggestions/{suggestionId}/audit`
- **Quyền:** `ADMIN`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Lấy nhật ký đề xuất công thức thành công",
  "data": [
    {
      "auditId": 12,
      "suggestionId": 700,
      "action": "AUTO_REJECTED",
      "actorId": 9,
      "actorName": "Giselle Uchinaga",
      "reason": "Tác giả đã gỡ đồng thuận dùng công thức cho bài viết này",
      "createdAt": "2026-10-22T09:20:00"
    }
  ],
  "timestamp": "2026-10-22T09:30:00Z"
}
```

**Giá trị `action`:**

| `action` | Ý nghĩa |
|---|---|
| `SUGGESTED` | Hệ thống vừa tạo đề xuất từ bài viết (reason ghi lại số view / vote đạt ngưỡng). |
| `APPROVED` | Admin duyệt đề xuất. |
| `REJECTED` | Admin từ chối đề xuất. |
| `AUTO_REJECTED` | Hệ thống tự đóng đề xuất vì bài viết không còn đồng thuận dùng công thức. |

## 11. Kiểm tra dữ liệu trước khi duyệt công thức (NB-86)

> Phạm vi: NB-86 (Thắng). Áp dụng cho luồng Admin duyệt đề xuất công thức.

### 11.1. Quy tắc chung

- Validator chạy **trước khi** tạo `Dish`/`Recipe`/`RecipeIngredient`. Mọi lỗi mức `ERROR` chặn duyệt và trả **HTTP 422**.
- Cảnh báo mức `WARNING` **không** chặn duyệt, chỉ hiển thị để Admin cân nhắc.
- Không còn cơ chế "tự sửa" dữ liệu: thiếu `quantity`/`unit` **không** còn bị đổi thành `1`/`"g"`, thiếu bước làm **không** còn được duyệt với `instructions = null`.
- `GET /api/v1/admin/content-recipe-suggestions/{suggestionId}` trả thêm khối `validation` khi đề xuất đang `PENDING`. Danh sách phân trang **không** trả khối này để tránh N+1.
- Đề xuất đã `APPROVED`/`REJECTED` không có khối `validation`.

### 11.2. Cấu trúc khối `validation`

```json
{
  "valid": false,
  "canApprove": false,
  "vegetarianType": null,
  "vegetarianVerdict": "NON_VEGETARIAN",
  "issues": [
    {
      "field": "ingredients[0].quantity",
      "code": "INGREDIENT_QUANTITY_REQUIRED",
      "severity": "ERROR",
      "message": "Nguyên liệu \"Ba chỉ heo\" thiếu định lượng"
    }
  ]
}
```

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `valid` | `boolean` | `true` khi không còn issue mức `ERROR`. |
| `canApprove` | `boolean` | `true` khi `valid = true` **và** đề xuất đang `PENDING`. |
| `vegetarianType` | `string \| null` | `VEGAN` / `LACTO` / `OVO` / `LACTO_OVO`; `null` khi không xác định hoặc có nguyên liệu động vật. |
| `vegetarianVerdict` | `string` | `VEGETARIAN`, `NON_VEGETARIAN` hoặc `UNKNOWN`. |
| `issues` | `array` | Danh sách vấn đề, mỗi phần tử gồm `field`, `code`, `severity`, `message`. |

### 11.3. Mã lỗi chặn duyệt (`severity = ERROR`)

| `code` | `field` | Điều kiện |
|---|---|---|
| `DISH_NAME_REQUIRED` | `dish.name` | Tên món rỗng. |
| `DISH_NAME_TOO_LONG` | `dish.name` | Tên món > 150 ký tự. |
| `RECIPE_TITLE_TOO_LONG` | `recipe.title` | Tiêu đề công thức > 200 ký tự. |
| `INGREDIENTS_JSON_INVALID` | `ingredients` | Cột `ingredients_json` không parse được. |
| `INGREDIENTS_REQUIRED` | `ingredients` | Danh sách nguyên liệu rỗng. |
| `INGREDIENT_ENTRY_INVALID` | `ingredients[i]` | Phần tử nguyên liệu không đúng định dạng. |
| `INGREDIENT_NAME_REQUIRED` | `ingredients[i].name` | Tên nguyên liệu rỗng. |
| `INGREDIENT_NAME_TOO_LONG` | `ingredients[i].name` | Tên nguyên liệu > 150 ký tự. |
| `INGREDIENT_DUPLICATED` | `ingredients[i].name` | Tên nguyên liệu lặp lại (sau chuẩn hóa). |
| `INGREDIENT_QUANTITY_REQUIRED` | `ingredients[i].quantity` | `quantity` null. |
| `INGREDIENT_QUANTITY_INVALID` | `ingredients[i].quantity` | `quantity` ≤ 0. |
| `INGREDIENT_UNIT_REQUIRED` | `ingredients[i].unit` | `unit` rỗng. |
| `INGREDIENT_UNIT_TOO_LONG` | `ingredients[i].unit` | `unit` > 30 ký tự. |
| `STEPS_JSON_INVALID` | `recipe.steps` | Cột `recipe_steps_json` không parse được. |
| `STEPS_REQUIRED` | `recipe.steps` | Không có bước làm nào (hoặc toàn rỗng). |
| `TOO_MANY_STEPS` | `recipe.steps` | > 50 bước. |
| `STEP_TOO_LONG` | `recipe.steps[i]` | Bước làm > 2000 ký tự. |
| `SERVINGS_REQUIRED` | `recipe.servings` | `servings` null. |
| `SERVINGS_INVALID` | `recipe.servings` | `servings` ≤ 0. |
| `SERVINGS_EXCEEDED` | `recipe.servings` | `servings` > `app.content-recipe-suggestion.max-servings` (mặc định 50). |
| `CALORIES_REQUIRED` | `nutrition.calories` | `calories` null. |
| `CALORIES_INVALID` | `nutrition.calories` | `calories` ≤ 0. |
| `PROTEIN_REQUIRED` / `CARBS_REQUIRED` / `FAT_REQUIRED` | `nutrition.proteinG` / `carbsG` / `fatG` | Macro null. |
| `PROTEIN_INVALID` / `CARBS_INVALID` / `FAT_INVALID` | tương ứng | Macro < 0. |
| `SERVING_SIZE_INVALID` | `dish.servingSize` | `servingSize` ≤ 0. |
| `SERVING_UNIT_TOO_LONG` | `dish.servingUnit` | `servingUnit` > 30 ký tự. |
| `NON_VEGETARIAN_INGREDIENT` | `ingredients` | Có nguyên liệu động vật (thịt/cá/hải sản/mắm/dầu hào/...). |
| `VEGETARIAN_TYPE_UNKNOWN` | `ingredients` | Không suy ra được loại chay. |
| `SOURCE_CONTENT_ALREADY_IMPORTED` | `sourceContent` | Bài viết nguồn đã được import thành công thức khác. |
| `DUPLICATE_DISH_NAME` | `dish.name` | Slug tên món trùng món đã có trong `dishes`. |

### 11.4. Mã cảnh báo (`severity = WARNING`)

| `code` | `field` | Điều kiện |
|---|---|---|
| `FIBER_MISSING` | `nutrition.fiberG` | Thiếu chất xơ. |
| `FIBER_INVALID` | `nutrition.fiberG` | Chất xơ âm. |
| `NUTRITION_INCONSISTENT` | `nutrition.calories` | `calories` lệch > 20% so với `protein*4 + carbs*4 + fat*9`. |
| `SERVING_INFO_MISSING` | `dish.serving` | Thiếu cả `servingSize` và `servingUnit`. |
| `SERVING_SIZE_MISSING` | `dish.servingSize` | Có đơn vị nhưng thiếu khối lượng. |
| `SERVING_UNIT_MISSING` | `dish.servingUnit` | Có khối lượng nhưng thiếu đơn vị. |
| `POSSIBLE_DUPLICATE_RECIPE` | `ingredients` | Tập nguyên liệu trùng ≥ ngưỡng Jaccard (mặc định `0.8`) với công thức đã có. |

### 11.5. Response khi duyệt thất bại

- **Endpoint:** `PUT /api/v1/admin/content-recipe-suggestions/{suggestionId}/review` với `action = APPROVE`
- **Response (422 Unprocessable Entity):**
```json
{
  "success": false,
  "code": "RECIPE_VALIDATION_FAILED",
  "message": "Dữ liệu đề xuất công thức chưa hợp lệ để duyệt",
  "data": [
    {
      "field": "recipe.servings",
      "code": "SERVINGS_REQUIRED",
      "severity": "ERROR",
      "message": "Công thức thiếu số khẩu phần"
    }
  ],
  "timestamp": "2026-10-22T10:00:00Z"
}
```

- Đề xuất **giữ nguyên** `PENDING`; không tạo `Dish`/`Recipe`/`RecipeIngredient`; không ghi audit `APPROVED`; không gửi thông báo.
- Kiểm tra nội dung nguồn (`published`, còn đồng thuận) vẫn chạy **trước** validator: bài viết đã ngừng công khai trả `409 Conflict` như cũ.

### 11.6. Cấu hình

| Property | Mặc định | Ý nghĩa |
|---|---|---|
| `app.content-recipe-suggestion.max-servings` | `50` | Giới hạn số khẩu phần tối đa. |
| `app.content-recipe-suggestion.duplicate-similarity-threshold` | `0.8` | Ngưỡng Jaccard để cảnh báo trùng nguyên liệu. |

## 12. Chốt chặn cuối khi duyệt đề xuất công thức (NB-87)

> Phạm vi: NB-87 (Thắng). Bổ sung quy tắc cho `PUT /api/v1/admin/content-recipe-suggestions/{suggestionId}/review`.

### 12.1. Điều kiện duyệt (đúng thứ tự kiểm tra)

1. Chỉ `ADMIN` được gọi endpoint (`/api/v1/admin/**` + `@PreAuthorize`).
2. `action` phải là `APPROVE` hoặc `REJECT`; giá trị khác trả `400`.
3. Trạng thái hiện tại phải là `PENDING`; ngoại lệ idempotent ở mục 12.2.
4. Nội dung nguồn phải còn `published`; nếu không trả `409`.
5. Đồng thuận của tác giả phải hợp lệ:
   - `recipeConsent = true` **và** `recipeConsentAt != null`; thiếu một trong hai trả `400` (`Tác giả chưa đồng thuận hợp lệ...`).
   - `recipeConsentTermsVersion` phải bằng phiên bản hiện hành (`v1`); lệch phiên bản trả `409` kèm thông báo cần đồng thuận lại.
6. Validator NB-86 phải trả `valid = true`; nếu không trả `422` với `data` là **mảng** issue (mục 11.5).
7. Chỉ khi tất cả điều kiện trên đạt: tạo đúng một `Dish` + một `Recipe` + các `RecipeIngredient`, cập nhật đề xuất `APPROVED`, ghi audit `APPROVED`, phát thông báo cho tác giả. Nội dung gốc (`contents`) **không bị sửa**.

### 12.2. Idempotency và xung đột

| Trạng thái hiện tại | `action` | Kết quả |
|---|---|---|
| `PENDING` | `APPROVE` | `200`, duyệt và tạo catalog như mục 12.1. |
| `APPROVED` | `APPROVE` | `200`, trả nguyên trạng đề xuất (kèm `dishId`/`recipeId` đã có). **Không** tạo thêm Dish/Recipe, không ghi audit, không gửi thông báo. |
| `REJECTED` | `APPROVE` | `409`. |
| `APPROVED` | `REJECT` | `409`. |
| `REJECTED` | `REJECT` | `409`. |

- Nếu hai admin duyệt đồng thời và lần ghi sau đụng ràng buộc unique (`UQ_dishes_name`, `UQ_dishes_slug`, `UQ_ingredients_name`, `UQ_ingredients_slug`) thì transaction rollback và trả `409` với thông báo tải lại đề xuất; không trả `500`.
- Lỗi gửi thông báo sau khi transaction đã commit **không** làm request duyệt thất bại (listener bắt lỗi và ghi log).

### 12.3. Hành vi Frontend Admin

- `GET /{suggestionId}` trả khối `validation` cho đề xuất `PENDING`; UI hiển thị panel "Pre-approval check" với các issue `ERROR`/`WARNING`, badge `vegetarianType` và nút **Approve bị vô hiệu hoá** khi `canApprove = false` hoặc đồng thuận không hợp lệ.
- UI coi đồng thuận là hợp lệ khi có `recipeConsentAt` và `recipeConsentTermsVersion = v1`; hiển thị `! Consent outdated` khi phiên bản lệch.
- Lỗi `422` trả `data` dạng mảng issue; UI hiển thị message của backend kèm danh sách `field` + `message` trong hộp thoại duyệt (không đóng hộp thoại để Admin xem lỗi).
- `409`/`404` khi duyệt: đóng hộp thoại, hiển thị toast "Suggestion changed on the server" và tải lại hàng đợi.


