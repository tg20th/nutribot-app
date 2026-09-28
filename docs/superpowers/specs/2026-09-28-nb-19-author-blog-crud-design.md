# Tài liệu Thiết kế Kỹ thuật: Author Blog CRUD & Thumbnail Upload Backend (NB-19)

> **Mã công việc:** Task NB-19  
> **Audit Gaps liên quan:** BL-005, BL-006, BL-013, BL-020  
> **Người thực hiện:** Trường (Backend)  
> **Ngày lập:** 28/09/2026  
> **Trạng thái:** Đã phê duyệt (Approved)  

---

## 1. 🎯 Bối cảnh & Mục tiêu

Xây dựng và chuẩn hóa toàn diện hệ thống API cho Tác giả (Author) quản lý bài viết Blog (CRUD) và tải lên ảnh thu nhỏ (Thumbnail Upload) trên nền tảng NutriBot, khắc phục triệt để 4 lỗ hổng kiểm toán kiến trúc:
1. **BL-005 (Ownership & IDOR Protection):** Bảo đảm mọi thao tác Blog đều trích xuất tác giả từ authenticated principal; không tin cậy `authorId` trong payload; ngăn chặn User A xem/sửa/xóa bài viết của User B.
2. **BL-006 (State Machine Integrity):** Định nghĩa máy trạng thái nghiêm ngặt; bài mới tạo luôn là `draft`; tác giả chỉ được phép chuyển giữa `draft` ↔ `under_review`; tuyệt đối cấm tác giả tự ý chuyển sang `published` hoặc `rejected`. Khi sửa bài đã duyệt (`published`/`rejected`), trạng thái tự động hạ về `draft` để Admin tái duyệt.
3. **BL-013 (Category & Media Validation):** Kiểm tra chặt chẽ `categoryId` (phải tồn tại, đang `active = true`, đúng loại `RECIPE`); kiểm định tập tin thumbnail (MIME `image/jpeg, image/png, image/webp`, dung lượng <= 5MB).
4. **BL-020 (Concurrency, Slug Uniqueness & Orphan Cleanup):** Sinh slug tiếng Việt chuẩn xác (khử dấu không làm mất chữ); xử lý deterministic tránh xung đột UNIQUE slug gây lỗi 500; dọn dẹp orphan asset trên Cloudinary khi xóa bài hoặc update ảnh.

---

## 2. 📐 Luồng Nghiệp vụ & Máy Trạng Thái (State Machine)

### 2.1. Sơ đồ Chuyển đổi Trạng thái

```text
               [ Tạo mới Blog (POST) ]
                          │
                          ▼
                      ┌───────┐
         ┌───────────►│ DRAFT │◄───────────┐
         │            └───┬───┘            │
         │                │                │ (Tác giả chỉnh sửa bài khi
         │       (Submit: Gửi duyệt)        │  đang Published / Rejected)
         │                ▼                │
         │         ┌──────────────┐        │
         └─────────┤ UNDER_REVIEW ├────────┘
        (Recall)   └──────┬───────┘
                          │
                  (Admin kiểm duyệt - NB-38)
                    ┌─────┴─────┐
                    ▼           ▼
               ┌─────────┐ ┌──────────┐
               │PUBLISHED│ │ REJECTED │
               └─────────┘ └──────────┘
```

### 2.2. Ma trận Chuyển đổi Trạng thái của Tác giả

| Trạng thái hiện tại | Thao tác tác giả | Trạng thái mới | Ghi chú |
| :--- | :--- | :--- | :--- |
| *(Mới tạo)* | `POST /author/blogs` | `draft` | Mặc định luôn là `draft` |
| `draft` | `PUT /author/blogs/{id}` (nội dung) | `draft` | Vẫn giữ trạng thái nháp |
| `draft` | `PUT ... status="under_review"` hoặc `POST .../submit` | `under_review` | Gửi bài vào hàng đợi duyệt |
| `under_review` | `PUT ... status="draft"` hoặc `POST .../recall` | `draft` | Rút bài về để chỉnh sửa |
| `under_review` | `PUT /author/blogs/{id}` (sửa nội dung) | `under_review` | Giữ nguyên hàng đợi duyệt |
| `published` | `PUT /author/blogs/{id}` (bất kỳ sửa đổi) | `draft` | Bắt buộc kiểm duyệt lại |
| `rejected` | `PUT /author/blogs/{id}` (bất kỳ sửa đổi) | `draft` | Khắc phục vi phạm, về nháp |
| Bất kỳ | `PUT ... status="published"` | **TỪ CHỐI** | Ném `BadRequestException` (400) |
| Bất kỳ | `PUT ... status="rejected"` | **TỪ CHỐI** | Ném `BadRequestException` (400) |
| Bất kỳ | `PUT ... status="flagged"` / `"archived"` | **TỪ CHỐI** | Ném `BadRequestException` (400) |

---

## 3. 🛡️ Quy chuẩn Bảo mật & Thiết kế API

### 3.1. Danh sách Endpoints

| Phương thức | URI | Phân quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/author/blogs` | Authenticated | Lấy danh sách blog của tác giả (phân trang) |
| `POST` | `/api/v1/author/blogs` | Authenticated | Tạo bài viết mới dạng bản nháp (`draft`) |
| `GET` | `/api/v1/author/blogs/{id}` | Authenticated (Owner) | Xem chi tiết bài viết của tác giả |
| `PUT` | `/api/v1/author/blogs/{id}` | Authenticated (Owner) | Cập nhật bài viết |
| `DELETE` | `/api/v1/author/blogs/{id}` | Authenticated (Owner) | Xóa bài viết & dọn dẹp ảnh Cloudinary |
| `POST` | `/api/v1/author/blogs/{id}/submit` | Authenticated (Owner) | Nộp bài duyệt (`DRAFT ➔ UNDER_REVIEW`) |
| `POST` | `/api/v1/author/blogs/{id}/recall` | Authenticated (Owner) | Rút bài về nháp (`UNDER_REVIEW ➔ DRAFT`) |
| `POST` | `/api/v1/blogs/thumbnails` | Authenticated | Tải lên ảnh thumbnail (khớp frontend) |
| `POST` | `/api/v1/author/blogs/thumbnail` | Authenticated | Alias tải lên ảnh thumbnail |

### 3.2. Cấu trúc Request / Response

#### DTO Cập nhật Blog (`ContentUpdateRequest`):
```java
public class ContentUpdateRequest {
    @Size(max = 255, message = "Tiêu đề không được vượt quá 255 ký tự")
    private String title;
    private String body;
    private Integer categoryId;
    private String mediaUrl;
    private String thumbnailUrl;
    private Integer durationSec;
    private String status; // Chỉ chấp nhận "draft" hoặc "under_review"
}
```

#### Upload Thumbnail Contract:
- **Header:** `Authorization: Bearer <token>`
- **Content-Type:** `multipart/form-data`
- **Form-data Field:** `file` (MultipartFile)
- **Response Format:**
```json
{
  "success": true,
  "message": "Tải ảnh thu nhỏ lên thành công",
  "data": {
    "thumbnailUrl": "https://res.cloudinary.com/example/image/upload/nutribot/thumbnails/thumb_1_8f93bc.jpg"
  },
  "timestamp": "2026-09-28T23:55:00Z"
}
```

---

## 4. ⚙️ Thiết kế Thành phần Kỹ thuật

### 4.1. `CloudinaryMediaService` (Tách biệt SRP)
- Quản lý độc lập lưu trữ ảnh thumbnail trong namespace `nutribot/thumbnails`.
- Kiểm tra tính hợp lệ của ảnh:
  - Dung lượng file tối đa: 5MB (`5 * 1024 * 1024` bytes).
  - MIME types hợp lệ: `image/jpeg`, `image/png`, `image/webp`.
- Hỗ trợ xóa an toàn theo URL Cloudinary: `deleteThumbnailByUrl(String secureUrl)`.

### 4.2. Khử dấu Tiếng Việt & Sinh Slug an toàn
- Sử dụng thuật toán:
  ```java
  String normalized = Normalizer.normalize(title, Normalizer.Form.NFD);
  Pattern pattern = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
  String ascii = pattern.matcher(normalized).replaceAll("").replace('đ', 'd').replace('Đ', 'D');
  String baseSlug = ascii.toLowerCase().replaceAll("[^a-z0-9\\s-]", "").replaceAll("\\s+", "-").replaceAll("-+", "-").trim();
  ```
- Thêm hậu tố timestamp và kiểm tra `contentRepository.existsBySlug(slug)` để tránh trùng lặp.

### 4.3. Xác thực Danh mục (Category Validation)
- Nếu `categoryId != null`:
  - `Category category = categoryRepository.findById(categoryId).orElseThrow(...)`
  - Bắt buộc: `category.getActive() == true` và `category.getCategoryType().equalsIgnoreCase("RECIPE")`.

---

## 5. 🧪 Kế hoạch Kiểm thử (Test Cases Specification)

Toàn bộ logic được kiểm thử tự động tại `AuthorContentServiceTest.java`:
1. `createContent_success_setsDraftAndUserFromPrincipal`: Tạo blog thành công, status luôn là `draft`.
2. `updateContent_ownerSuccess`: Tác giả cập nhật bài viết của mình thành công.
3. `updateContent_nonOwner_throwsForbidden`: User B sửa bài của User A ➔ Bị chặn 403 Forbidden.
4. `deleteContent_nonOwner_throwsForbidden`: User B xóa bài của User A ➔ Bị chặn 403 Forbidden.
5. `getContentById_nonOwner_throwsForbidden`: User B xem bài của User A ➔ Bị chặn 403 Forbidden.
6. `getContentById_notFound_throwsNotFound`: Tra cứu bài không tồn tại ➔ 404 Not Found.
7. `updateContent_publishedOrRejected_resetsToDraft`: Bài viết đang `published`/`rejected` khi sửa tự động chuyển về `draft`.
8. `updateContent_invalidStatusTransition_throwsBadRequest`: Tác giả gửi `status="published"` hoặc `"rejected"` ➔ Bị chặn 400 Bad Request.
9. `submitContent_transitionsToUnderReview`: Gửi duyệt chuyển trạng thái sang `under_review`.
10. `recallContent_transitionsToDraft`: Rút bài chuyển trạng thái về `draft`.
11. `createContent_invalidCategoryTypeOrInactive_throwsBadRequest`: Chọn danh mục sai type hoặc inactive ➔ 400 Bad Request.
12. `deleteContent_cleansUpCloudinaryThumbnail`: Xóa bài tự động dọn dẹp ảnh thumbnail trên Cloudinary.
13. `generateSlug_handlesVietnameseDiacritics`: Khử dấu tiếng Việt chính xác và đảm bảo tính duy nhất.
