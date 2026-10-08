# Kế hoạch triển khai: Quét ảnh Thumbnail bằng Gemini Multimodal trong AI Moderation

> **Mục tiêu:** Mở rộng hệ thống kiểm duyệt bài viết NutriBot (NB-64 / NB-65) để hỗ trợ quét ảnh thumbnail (của cả Blog và Video) qua Gemini Multimodal API, nhận diện ảnh phản cảm/bạo lực/18+ và phát hiện thịt động vật đối với các bài thuộc chuyên mục ăn chay. Nếu ảnh lỗi hoặc không tải được, tự động chuyển về `NEEDS_REVIEW` cho Admin duyệt thủ công.

---

## 🏗️ Danh sách các tệp thay đổi

1. **AI Microservice (`ai-service`):**
   - [`app/schemas/moderation.py`](file:///c:/Users/PC/Documents/26FA/SWP391/Project/swp391_group7_nutribot/ai-service/app/schemas/moderation.py): Thêm `thumbnail_url: str | None = None`, `media_url: str | None = None` vào `ModerationRequest`; thêm `"SENSITIVE_IMAGE"`, `"NON_VEGETARIAN_IMAGE"` vào `Category`.
   - [`app/services/gemini_service.py`](file:///c:/Users/PC/Documents/26FA/SWP391/Project/swp391_group7_nutribot/ai-service/app/services/gemini_service.py): Cho phép `_generate_with_fallback` nhận `contents: Any`. Trong `moderate_content`, nếu có `thumbnail_url`, tải ảnh qua `httpx.AsyncClient` (timeout 4s), đóng gói `types.Part.from_bytes`, cập nhật prompt yêu cầu kiểm tra hình ảnh. Nếu lỗi tải ảnh, trả về kết quả `NEEDS_REVIEW`.
   - [`tests/test_content_moderation.py`](file:///c:/Users/PC/Documents/26FA/SWP391/Project/swp391_group7_nutribot/ai-service/tests/test_content_moderation.py): Thêm kiểm thử cho trường hợp có `thumbnail_url`, ảnh hợp lệ, ảnh vi phạm, và lỗi tải ảnh.

2. **Backend Spring Boot (`backend`):**
   - [`backend/src/main/java/com/fpt/swp391/nutribot/service/ContentModerationGatewayService.java`](file:///c:/Users/PC/Documents/26FA/SWP391/Project/swp391_group7_nutribot/backend/src/main/java/com/fpt/swp391/nutribot/service/ContentModerationGatewayService.java): Cập nhật `moderateContent` nhận thêm `thumbnailUrl`, `mediaUrl` và truyền vào JSON request gửi FastAPI.
   - [`backend/src/main/java/com/fpt/swp391/nutribot/service/AuthorContentService.java`](file:///c:/Users/PC/Documents/26FA/SWP391/Project/swp391_group7_nutribot/backend/src/main/java/com/fpt/swp391/nutribot/service/AuthorContentService.java): Truyền `content.getThumbnailUrl()` và `content.getMediaUrl()` sang Gateway.
   - [`backend/src/test/java/com/fpt/swp391/nutribot/service/AuthorContentServiceTest.java`](file:///c:/Users/PC/Documents/26FA/SWP391/Project/swp391_group7_nutribot/backend/src/test/java/com/fpt/swp391/nutribot/service/AuthorContentServiceTest.java): Cập nhật các mock verification và assertions.

---

## 📋 Nhiệm vụ chi tiết (Bite-sized Tasks)

### Task 1: Cập nhật Schema AI Moderation
- **File:** `ai-service/app/schemas/moderation.py`
- **Hành động:**
  - Thêm `thumbnail_url: str | None = None` và `media_url: str | None = None` vào `ModerationRequest`.
  - Thêm `"SENSITIVE_IMAGE"` và `"NON_VEGETARIAN_IMAGE"` vào kiểu `Category`.
- **Kiểm thử:** Chạy `pytest tests/test_content_moderation.py`.

### Task 2: Triển khai Multimodal Image Processing trong `GeminiService`
- **File:** `ai-service/app/services/gemini_service.py`
- **Hành động:**
  - Cập nhật hàm `_generate_with_fallback(self, client, prompt: Any, config: types.GenerateContentConfig)` để `contents` có thể là `str` hoặc `list`.
  - Trong `moderate_content(self, request)`:
    - Nếu có `request.thumbnail_url`:
      - Dùng `httpx.AsyncClient(timeout=4.0)` để tải ảnh.
      - Nếu tải thành công, tạo `types.Part.from_bytes(data=image_data, mime_type=mime_type)`.
      - Xây dựng prompt kiểm tra text + ảnh:
        - Kiểm tra nhạy cảm / 18+ / bạo lực máu me (`SENSITIVE_IMAGE`).
        - Nếu bài thuộc chuyên mục ăn chay: kiểm tra xem ảnh có chứa thịt gia súc, gia cầm, hải sản không (`NON_VEGETARIAN_IMAGE`).
      - Truyền `contents=[prompt_text, image_part]`.
    - Nếu tải ảnh thất bại (HTTP error, timeout, invalid URL): trả về `ModelModeration(decision="NEEDS_REVIEW", reason="Không thể tải hoặc xác thực ảnh thumbnail để kiểm duyệt tự động", confidence=0.0, categories=["AMBIGUOUS"])`.
- **Kiểm thử:** Viết unit test mock cho `GeminiService` và chạy `pytest`.

### Task 3: Bổ sung Unit Test cho AI Service
- **File:** `ai-service/tests/test_content_moderation.py`
- **Hành động:**
  - Thêm test case cho `thumbnail_url`:
    - Test `ModerationRequest` với `thumbnail_url` được serialize/deserialize đúng.
    - Test fallback `NEEDS_REVIEW` khi ảnh lỗi.
    - Test các category mới (`SENSITIVE_IMAGE`, `NON_VEGETARIAN_IMAGE`).
- **Kiểm thử:** Chạy `pytest tests/test_content_moderation.py` đạt 100%.

### Task 4: Cập nhật Backend Gateway Service
- **File:** `backend/src/main/java/com/fpt/swp391/nutribot/service/ContentModerationGatewayService.java`
- **Hành động:**
  - Bổ sung tham số `String thumbnailUrl, String mediaUrl` vào phương thức `moderateContent`.
  - Thêm `request.put("thumbnail_url", thumbnailUrl != null ? thumbnailUrl : "");`
  - Thêm `request.put("media_url", mediaUrl != null ? mediaUrl : "");`
- **Kiểm thử:** Chạy `./mvnw compile`.

### Task 5: Cập nhật AuthorContentService và Unit Tests
- **File:** `backend/src/main/java/com/fpt/swp391/nutribot/service/AuthorContentService.java`
- **Hành động:**
  - Truyền `content.getThumbnailUrl()` và `content.getMediaUrl()` vào `contentModerationGatewayService.moderateContent(...)`.
- **File:** `backend/src/test/java/com/fpt/swp391/nutribot/service/AuthorContentServiceTest.java`
- **Hành động:**
  - Cập nhật mock gọi `moderateContent` khớp danh sách đối số mới.
- **Kiểm thử:** Chạy `./mvnw test` đạt 166/166 tests.

### Task 6: Kiểm thử tổng thể & Tái khởi động dịch vụ
- **Hành động:**
  - Khởi động lại Spring Boot backend với code mới.
  - Chạy toàn bộ frontend tests (`npm test -- --run`).
  - Xác nhận luồng nộp bài có thumbnail hoạt động trơn tru.
