# Kế hoạch triển khai: Admin Comments API & Moderation (NB-40)

> **Dành cho Agent/Developer thực thi:** BẮT BUỘC sử dụng sub-skill `superpowers:executing-plans` để thực hiện từng bước. Mỗi task tuân thủ nghiêm ngặt Test-Driven Development (TDD) và quy chuẩn Git 50/72 bằng tiếng Việt. Tuyệt đối không can thiệp mã nguồn Frontend.

**Mã Task Jira:** `NB-40`  
**Thành viên phụ trách:** Trường (Backend)  
**Goal:** Xây dựng và hoàn thiện Admin Comments API (`GET /api/v1/admin/comments`, `DELETE /api/v1/admin/comments/{commentId}`, `PUT /api/v1/admin/comments/{commentId}/status`) đáp ứng tìm kiếm/lọc/phân trang chuẩn 100% tại CSDL, triệt tiêu lỗi N+1 Query, chuyển đổi xóa sang Soft-Delete (`status = 'hidden'`) chống lỗi khóa ngoại FK với reply model, áp dụng khóa bi quan (`PESSIMISTIC_WRITE`) chống race condition và phân quyền chặt chẽ cho Quản trị viên (`ROLE_ADMIN`).

**Kiến trúc:**  
- **Controller & Security:** `AdminCommentController` gắn `@PreAuthorize("hasRole('ADMIN')")` và deny-by-default qua `SecurityConfig`.
- **Database Query & Specifications:** `CommentRepository` kế thừa `JpaSpecificationExecutor<Comment>` kết hợp `CommentSpecifications` để lọc động theo `keyword` (trên `body` và `user.username`) và `status` (`published`, `hidden`, `rejected`) tại CSDL, đảm bảo `totalElements` và `totalPages` đồng nhất với filter.
- **Batch Mapping:** Gom `contentIds` trong trang để truy vấn batch 1 lần `findAllById` triệt tiêu lỗi N+1 Query.
- **Soft-Delete Guard:** Thay thế `delete()` bằng cập nhật `status = 'hidden'`, bảo toàn liên kết của bình luận con trong cây thảo luận (BL-007, BL-022) và tránh lỗi khóa ngoại `FK_comments_parent`.
- **Status Moderation:** API `PUT /api/v1/admin/comments/{id}/status` dùng `findByIdForUpdate` kiểm soát xung đột tương tranh và ghi log Audit.

**Tech Stack:** Java 25, Spring Boot 3.x, Spring Data JPA, Spring Security 6, Hibernate, JUnit 5, Mockito, AssertJ.

---

## Global Constraints

- **Response Wrapper:** Mọi endpoint đều trả về `ApiResponse<T>` chuẩn hóa của dự án.
- **Commit Messages:** 100% tiếng Việt theo chuẩn Git 50/72: `feat(NB-40-BE): ...` hoặc `test(NB-40-BE): ...`, thêm `#done Closes NB-40` ở commit hoàn tất.
- **Không đụng chạm Frontend:** Tuyệt đối không chỉnh sửa bất kỳ file nào trong thư mục `frontend/`. Mọi thay đổi ở BE phải tương thích hoàn toàn với `frontend/src/services/adminCommentsApi.js` và `frontend/src/pages/admin/CommentManagementPage.jsx`.
- **Pagination Boundary:** `page >= 0`, `size in [1, 50]` (mặc định 10).
- **Authorization:** Chỉ tài khoản có `ROLE_ADMIN` mới được phép thao tác.

---

## Review Focus (5 Trọng tâm Kiểm toán & Rủi ro Tiềm ẩn)

1. **Foreign Key Violation on Hard Delete (BL-007):** Bình luận cha có replies bị xóa bằng `delete()` sẽ văng lỗi `SqlException (conflicted with FK_comments_parent)`. Phải chuyển sang Soft-Delete `status = 'hidden'`.
2. **Fake In-memory Pagination & Broken Count:** Không bao giờ dùng `findAll()` rồi bỏ qua tham số lọc. Specification phải sinh ra câu lệnh SQL `WHERE` và `COUNT(*)` chính xác tại CSDL.
3. **N+1 Query Bottleneck:** Tránh việc mỗi bình luận lại kích hoạt 1 câu `findById(contentId)`.
4. **Race Condition between Admins:** Hai Admin cùng ẩn/xóa bình luận đồng thời phải được tuần tự hóa an toàn qua `findByIdForUpdate`.
5. **Contract Compatibility:** Đảm bảo `DELETE /api/v1/admin/comments/{id}` trả về `ApiResponse<Void>` với HTTP 200 để Frontend hiển thị Toast thông báo thành công mà không phải sửa 1 dòng code FE nào.

---

## Kế hoạch triển khai từng Task

### Task 1: DTO Request, Entity Specification & Repository Alignment

**Files:**
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/dto/request/AdminCommentStatusRequest.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/repository/specification/CommentSpecifications.java`
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/repository/CommentRepository.java`

- [ ] **Step 1: Tạo DTO `AdminCommentStatusRequest.java`**
Validate `status` bắt buộc thuộc canonical set (`PUBLISHED`, `HIDDEN`, `REJECTED`) và trường `reason` phục vụ kiểm toán.

- [ ] **Step 2: Cập nhật `CommentRepository` kế thừa `JpaSpecificationExecutor<Comment>`**
Cho phép thực thi truy vấn động với `Specification<Comment>`.

- [ ] **Step 3: Tạo `CommentSpecifications.java`**
Tạo static method `withFilter(String keyword, String status)` tạo predicate tìm kiếm trên `body`, `user.username` và so khớp `status`.

- [ ] **Step 4: Kiểm tra build biên dịch**
Chạy: `.\mvnw.cmd test-compile`

---

### Task 2: Refactor `AdminCommentService` (Soft Delete, Batch Fetching, DB Filtering & Moderation)

**Files:**
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/service/AdminCommentService.java`

- [ ] **Step 1: Triển khai phân trang an toàn & lọc Specification tại `getAllComments`**
Kẹp `page >= 0`, `size in [1, 50]`. Gọi `commentRepository.findAll(spec, pageable)`.

- [ ] **Step 2: Tối ưu hóa N+1 query với batch fetch contents**
Trích xuất danh sách `contentIds` từ trang bình luận, gọi `contentRepository.findAllById(contentIds)` và đưa vào Map để ánh xạ nhanh.

- [ ] **Step 3: Chuyển `deleteComment` sang Soft-Delete an toàn**
Dùng `findByIdForUpdate`, kiểm tra tồn tại, cập nhật `status = 'hidden'`, lưu DB và ghi Audit log.

- [ ] **Step 4: Bổ sung method `updateCommentStatus`**
Kiểm tra tính hợp lệ của status mới, cập nhật `status` (`published`, `hidden`, `rejected`), cập nhật `updatedAt`, lưu DB và ghi Audit log.

---

### Task 3: Cập nhật `AdminCommentController` & Phân quyền Server-Side

**Files:**
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/controller/AdminCommentController.java`

- [ ] **Step 1: Thêm `@PreAuthorize("hasRole('ADMIN')")` cấp Class**
Bảo vệ phân quyền chặt chẽ.

- [ ] **Step 2: Bổ sung endpoint `PUT /api/v1/admin/comments/{commentId}/status`**
Tiếp nhận `@Valid @RequestBody AdminCommentStatusRequest` và `Authentication` principal, trả về `ApiResponse<AdminCommentResponse>`.

- [ ] **Step 3: Cập nhật `deleteComment` truyền username Quản trị viên**
Hỗ trợ ghi log kiểm toán.

---

### Task 4: Viết bộ kiểm thử Unit Test toàn diện (TDD Verification)

**Files:**
- Create: `backend/src/test/java/com/fpt/swp391/nutribot/service/AdminCommentServiceTest.java`
- Create: `backend/src/test/java/com/fpt/swp391/nutribot/controller/AdminCommentControllerTest.java`

- [ ] **Step 1: Viết `AdminCommentServiceTest.java`**
Kiểm thử 7 kịch bản:
  1. Lấy danh sách phân trang có keyword và status
  2. Kẹp an toàn khi truyền page âm hoặc size quá lớn
  3. Xóa bình luận thành công (Soft delete sang `hidden`)
  4. Xóa bình luận không tồn tại ném `NotFoundException`
  5. Cập nhật trạng thái kiểm duyệt thành công
  6. Cập nhật trạng thái trùng lặp (Idempotent)
  7. Tối ưu batch fetch content không bị lỗi khi content không tìm thấy

- [ ] **Step 2: Viết `AdminCommentControllerTest.java`**
Kiểm thử 5 kịch bản:
  1. `GET /api/v1/admin/comments` trả về 200 và cấu trúc PagedResponse
  2. `DELETE /api/v1/admin/comments/{id}` trả về 200 và ApiResponse null
  3. `PUT /api/v1/admin/comments/{id}/status` trả về 200 khi payload hợp lệ
  4. `PUT /api/v1/admin/comments/{id}/status` trả về 400 khi status để trống hoặc không hợp lệ

- [ ] **Step 3: Chạy toàn bộ test suite xác nhận 100% pass**
Chạy: `.\mvnw.cmd test "-Dtest=AdminCommentServiceTest,AdminCommentControllerTest"`

---

### Task 5: Cập nhật `PROJECT_TODO.md` và Hoàn tất Git Commit

- [ ] **Step 1: Kiểm tra lại toàn bộ file diff trên git**
- [ ] **Step 2: Commit code theo chuẩn Git 50/72 tiếng Việt**
- [ ] **Step 3: Cập nhật `PROJECT_TODO.md` tick hoàn thành NB-40**
