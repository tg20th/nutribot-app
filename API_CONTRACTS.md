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
- **Header:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "fullName": "Hoàng Thị Lan",
  "email": "lan@nutribot.com",
  "bio": "Yêu thích các món ăn lành mạnh và giàu đạm thực vật.",
  "gender": "Female",
  "dateOfBirth": "2003-05-15"
}
```
- **Response (200 OK):** Trả về `ApiResponse` chứa hồ sơ đã cập nhật.

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
- **Endpoint:** `PUT /api/v1/users/profile/health`
- **Header:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "heightCm": 168.0,
  "weightKg": 58.0,
  "gender": "Nữ",
  "dateOfBirth": "2003-05-15",
  "healthGoal": "gain_muscle",
  "allergyIngredientIds": [2, 5]
}
```

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

### 5.1. Xem thực đơn tuần hiện tại
- **Endpoint:** `GET /api/v1/weekly-menus/current`
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
            "servings": 1.0,
            "notes": "Ăn kèm sữa hạnh nhân"
          }
        ]
      }
    ]
  }
}
```

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
  "sessionId": 12,
  "message": "Tôi bị dị ứng đậu phộng, tôi có thể thay thế bằng gì khi làm sốt salad?"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "sessionId": 12,
    "senderType": "ASSISTANT",
    "content": "Chào bạn! Bạn hoàn toàn có thể thay thế đậu phộng bằng bơ mè (tahini)...",
    "remainingTrialCount": 2,
    "createdAt": "2026-09-24T08:35:10Z"
  }
}
```

---

## 7. AI Meal Planner (Sinh Thực Đơn Bằng AI - Lan & Thắng)

- **Endpoint:** `POST /api/v1/meal-planner/generate`
- **Request Body:**
```json
{
  "targetCalories": 1800,
  "healthGoal": "lose_weight",
  "availableIngredients": ["đậu phụ", "nấm rơm", "cà chua", "rau cải"],
  "excludedAllergies": ["đậu phộng"]
}
```
- **Response (200 OK - Kế hoạch 7 ngày xem trước):**
```json
{
  "success": true,
  "message": "AI đã tạo thực đơn thành công",
  "data": {
    "suggestedMenuTitle": "Thực đơn chay giảm cân thanh đạm 7 ngày",
    "estimatedDailyCalories": 1750,
    "weeklyPlan": [
      {
        "day": "Thứ 2",
        "breakfast": "Cháo yến mạch nấm rơm",
        "lunch": "Đậu phụ sốt cà chua, canh cải nấu nấm, cơm gạo lứt",
        "dinner": "Salad rau củ sốt mè, canh rong biển đậu hũ"
      }
    ]
  }
}
```

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
