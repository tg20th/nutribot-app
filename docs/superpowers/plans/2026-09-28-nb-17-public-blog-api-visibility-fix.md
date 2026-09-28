# Kế hoạch triển khai: Chuẩn hóa Visibility Rule cho Public Blog APIs (NB-17 / BL-011)

> **Dành cho Agentic Workers:** REQUIRED SUB-SKILL: Sử dụng `superpowers:executing-plans` hoặc `superpowers:subagent-driven-development` để thực hiện từng task. Các bước dùng checkbox (`- [ ]`) để theo dõi.

**Mục tiêu:** Khắc phục triệt để lỗ hổng rò rỉ thông tin bài viết chưa công khai (Audit Gap BL-011), chuẩn hóa Visibility Predicate ở tầng Database cho `GET /api/v1/blogs` và `GET /api/v1/blogs/{id|slug}`, đảm bảo Guest không thể dò quét draft/rejected và chỉ đọc được bài viết đã xuất bản từ tác giả đang hoạt động (ACTIVE).

**Kiến trúc:** Bổ sung các query method an toàn tại `ContentRepository` lọc trực tiếp `status = 'published'` và `user.status = AccountStatus.ACTIVE`. Cập nhật `ContentService` ném `NotFoundException` (HTTP 404) thay vì `BadRequestException` (HTTP 400). Viết bộ Unit Test toàn diện `ContentServiceTest` để khóa chặt hành vi.

**Tech Stack:** Java 25, Spring Boot 3.x / 4.x, Spring Data JPA, JUnit 5, Mockito.

**Spec / Audit Reference:** Ticket NB-17 (Public Blog List & Detail APIs) & BL-011 (Visibility Rule & Draft Information Leak Prevention).

---

## Global Constraints
- Tuân thủ cấu trúc phản hồi `ApiResponse<T>` theo chuẩn `API_CONTRACTS.md`.
- Trả về mã lỗi HTTP 404 Not Found (`NotFoundException`) cho mọi trường hợp draft, pending, rejected, inactive author hoặc ID/slug không tồn tại.
- Giữ vững DTO Allowlist trong `ContentListResponse` và `ContentDetailResponse`, không để lộ bất kỳ trường moderation hay private author nào.
- Commit message 100% tiếng Việt theo chuẩn Git 50/72 quy định trong `AGENTS.md`.

---

## Review Focus (Các trường hợp biên cần bảo vệ)
1. **Dò quét ID Draft (ID Enumeration):** Guest gọi `GET /api/v1/blogs/id/{draftId}` ➡️ Bắt buộc trả về HTTP 404 Not Found, không trả về 400 và không kèm nội dung bài viết.
2. **Dò quét Slug Draft:** Guest gọi `GET /api/v1/blogs/{draftSlug}` ➡️ Bắt buộc trả về HTTP 404 Not Found.
3. **Tác giả bị BANNED/INACTIVE:** Bài viết dù có `status = 'published'` nhưng tác giả có `status != ACTIVE` ➡️ Bắt buộc không hiển thị trong danh sách và trả về 404 khi truy cập chi tiết.
4. **Sai Content Type:** ID của video gọi vào endpoint blog hoặc ngược lại ➡️ Bắt buộc trả về HTTP 404 Not Found.
5. **Deterministic Sorting:** Phân trang danh sách blog phải có tie-breaker `contentId DESC` kèm `createdAt DESC` để tránh trùng lặp bản ghi giữa các trang.

---

## Chi tiết các Task thực hiện

### Task 1: Bổ sung Query Visibility Predicate tại ContentRepository
**Files:**
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/repository/ContentRepository.java`

- [ ] **Bước 1: Khai báo các query method kẹp trực tiếp visibility predicate**
```java
    @Query("SELECT c FROM Content c WHERE c.slug = :slug AND c.contentType = :contentType AND c.status = :status AND c.user.status = com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE")
    Optional<Content> findPublishedBySlugAndType(
            @Param("slug") String slug,
            @Param("contentType") String contentType,
            @Param("status") String status);

    @Query("SELECT c FROM Content c WHERE c.contentId = :contentId AND c.contentType = :contentType AND c.status = :status AND c.user.status = com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE")
    Optional<Content> findPublishedByIdAndType(
            @Param("contentId") Integer contentId,
            @Param("contentType") String contentType,
            @Param("status") String status);
```

- [ ] **Bước 2: Kiểm tra biên dịch**
Run: `.\mvnw.cmd compile -DskipTests` (trong thư mục `backend`)
Expected: BUILD SUCCESS

---

### Task 2: Cập nhật ContentService tuân thủ Visibility Policy & 404 Guard
**Files:**
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/service/ContentService.java`

- [ ] **Bước 1: Chuyển đổi getBlogBySlug và getBlogById sang query repository an toàn**
  - Thay thế việc fetch không điều kiện rồi check Java bằng `findPublishedBySlugAndType` và `findPublishedByIdAndType`.
  - Thay `BadRequestException` bằng `NotFoundException("Bài viết không tồn tại")`.
  - Đồng bộ logic tương tự cho video (`getVideoBySlug`, `getVideoById`) với `NotFoundException("Video không tồn tại")`.

- [ ] **Bước 2: Chuẩn hóa getPublishedBlogs và getPublishedVideos với Active Author & Tie-Breaker**
  - Sử dụng `findPublishedByType` và `findPublishedByTypeAndCategory` (đã có sẵn filter `user.status = ACTIVE`).
  - Phân trang với `Sort.by(Sort.Direction.DESC, "createdAt", "contentId")`.
  - Giới hạn tham số `page >= 0` và `size in [1, 50]`.

- [ ] **Bước 3: Kiểm tra biên dịch**
Run: `.\mvnw.cmd compile -DskipTests` (trong thư mục `backend`)
Expected: BUILD SUCCESS

---

### Task 3: Viết Unit Test toàn diện cho ContentService (ContentServiceTest)
**Files:**
- Create: `backend/src/test/java/com/fpt/swp391/nutribot/service/ContentServiceTest.java`

- [ ] **Bước 1: Viết các test case kiểm tra visibility và mã lỗi 404**
  - `getBlogById_WhenDraft_ThrowsNotFoundException()`: Mock repository trả về `Optional.empty()`, verify service quăng `NotFoundException`.
  - `getBlogBySlug_WhenDraft_ThrowsNotFoundException()`: Mock repository trả về `Optional.empty()`, verify service quăng `NotFoundException`.
  - `getBlogById_WhenPublishedAndAuthorActive_ReturnsDetailAndIncrementsViewCount()`: Verify tăng viewCount và trả về allowlisted DTO.
  - `getPublishedBlogs_FiltersOutInactiveAuthorAndUsesDeterministicSort()`: Verify repository được gọi với đúng sort và status predicate.
  - `getVideoById_WhenDraft_ThrowsNotFoundException()`: Kiểm tra video cũng tuân thủ 404 guard.

- [ ] **Bước 2: Chạy kiểm thử Unit Test**
Run: `.\mvnw.cmd test -Dtest=ContentServiceTest` (trong thư mục `backend`)
Expected: Tests run: 5, Failures: 0, Errors: 0, BUILD SUCCESS.

---

### Task 4: Kiểm tra toàn diện & Cập nhật tài liệu
- [ ] **Bước 1: Chạy toàn bộ test suite của backend**
Run: `.\mvnw.cmd test`
Expected: Tất cả test suite đều xanh (BUILD SUCCESS).

- [ ] **Bước 2: Kiểm thử gọi API thực tế qua PowerShell / curl**
  - Gọi ID draft / không tồn tại ➡️ xác nhận nhận về HTTP 404 Not Found.
  - Gọi ID published ➡️ xác nhận nhận về HTTP 200 OK với đúng DTO.
