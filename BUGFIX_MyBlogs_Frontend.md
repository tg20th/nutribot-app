# Bug Fix: My Blogs Page - Frontend Checklist

## Dành cho Lan / Khánh

---

## Mô tả Bug
Trang "My Blogs" không load được dữ liệu, có thể do:
1. Không truyền token khi gọi API
2. Không xử lý đúng error response 401

---

## Checklist để kiểm tra

### 1. Kiểm tra MyBlogsPage.jsx

```jsx
// Tìm hàm getMyBlogs - phải có header Authorization
const getMyBlogs = async () => {
  try {
    const token = localStorage.getItem('token'); // hoặc sessionStorage

    const response = await fetch(`${API_BASE_URL}/api/v1/author/blogs`, {
      headers: {
        'Authorization': `Bearer ${token}`,  // ← PHẢI CÓ DÒNG NÀY
        'Content-Type': 'application/json'
      }
    });

    // Kiểm tra response
    if (!response.ok) {
      throw new Error('Failed to fetch blogs');
    }

    const data = await response.json();
    setBlogs(data.data.content);  // ← Frontend phải đọc đúng path
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### 2. Kiểm tra Response Format

Backend trả về format:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "content": [...],       // ← Mảng blogs nằm ở đây
    "page": 0,
    "totalElements": 10,
    ...
  }
}
```

Frontend phải đọc: `response.data.data.content`

### 3. Kiểm tra Error Handling

```jsx
// Nếu nhận được 401 Unauthorized
if (response.status === 401) {
  // Redirect về trang login
  localStorage.removeItem('token');
  window.location.href = '/login';
}
```

### 4. Kiểm tra Auth Flow

Đảm bảo:
- Token được lưu vào localStorage/sessionStorage khi đăng nhập
- Token được gửi kèm mọi request cần authentication
- Khi token hết hạn, xử lý logout

---

## API Endpoint
- **URL:** `GET /api/v1/author/blogs?page=0&size=10`
- **Headers:** `Authorization: Bearer {token}`
- **Response:** `ApiResponse<PagedResponse<AuthorContentResponse>>`

---

## Test Cases

1. **Đã login** → Xem danh sách blogs của mình ✓
2. **Chưa login** → Redirect về login page
3. **Token hết hạn** → Nhận 401, redirect login
4. **Không có blog nào** → Hiển thị empty state

---

## Câu hỏi cần trả lời

1. File `MyBlogsPage.jsx` có tồn tại không?
2. Có gọi API với token không?
3. Có xử lý error 401 không?
4. Đọc response đúng path `data.data.content` không?

---

## Backend đã làm gì
1. Thêm logging vào JwtAuthenticationFilter
2. Thêm logging vào JwtTokenProvider (log rõ lỗi token expired/malformed)
3. Thêm logging vào AuthorContentService
4. Thêm handler cho AuthenticationException trong GlobalExceptionHandler

→ Chạy backend, mở console/log để xem token có được parse đúng không.
