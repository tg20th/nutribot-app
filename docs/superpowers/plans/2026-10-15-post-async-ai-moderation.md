# Plan: Async AI Moderation + Polling Badge để cải thiện UX Submit Post

## Context

Hiện tại khi tác giả nhấn "Post" trên trang tạo/sửa blog hoặc video, request HTTP phải chờ AI moderation hoàn tất (timeout 30s) trước khi trả response. Trong khoảng đó nút bị disabled và spinner quay liên tục — UX rất tệ, đặc biệt khi AI service chậm.

**Phân tích luồng hiện tại (xác nhận từ explore):**

- `CreateBlogPage.jsx:521-585`: `submit(event, intent)` gọi 2 API tuần tự: (1) `createMyBlog`/`updateMyBlog` (nhanh, status=draft), (2) `submitForReview` (chậm, blocking chờ AI). Sau khi cả 2 xong mới `navigate` và `setBusy(false)`.
- `AuthorContentService.java:201-259`: `submitContent` gộp 3 bước trong `@Transactional`: set `under_review` → gọi `contentModerationGatewayService.moderateContent()` (blocking HTTP tới AI service FastAPI) → cập nhật status cuối (`published` hoặc giữ `under_review`).
- `ContentModerationGatewayService.java:48-101`: gọi `POST /api/ai/moderate-content` với readTimeout 30s. Không có `@Async`, không qua queue.

**Hạ tầng async đã có sẵn (chỉ chưa dùng cho submit):**

- `@EnableAsync` bật toàn cục tại `Swp391Group7NutribotApplication.java:8`.
- `@Async` đang dùng ở `OtpService.java:126` và `ContentRecipeSuggestionService.java:70`.
- `ApplicationEventPublisher` đang dùng ở `AdminModerationService.java:34, 91` (fire `ContentPublishedEvent` khi admin approve).
- Listener `ContentRecipeSuggestionListener` xử lý `ContentPublishedEvent` async — pattern đã chứng minh hoạt động.

**Hệ quả mong đợi:**
- Tác giả bấm "Post" → trang lưu + navigate về My Blogs trong < 500ms.
- Bài vừa post có badge "Đang kiểm duyệt" + spinner nhỏ xoay.
- Polling mỗi 3s cập nhật status (chỉ polling khi có row ở trạng thái `ai_processing`).
- AI duyệt xong → badge đổi thành "Đã đăng" hoặc "Chờ admin duyệt" hoặc "Bị từ chối".
- Khi user tắt tab → polling dừng, mở lại tab sẽ thấy status cuối.

## Branch & Commit

- Branch: `fix/post-async-ai-moderation` (NB chưa có số, sẽ tạo mới trong TODO sau khi PR merge).
- 1 task = 1 branch = 1 commit.
- Commit message 100% tiếng Việt, Git 50/72, có `#done`.
- Tiêu đề: `fix(BE/FE): bất đồng bộ AI moderation khi submit post #done`

## Critical Files

### Backend (Spring Boot)

1. **`backend/src/main/java/com/fpt/swp391/nutribot/service/AuthorContentService.java`**
   - Thêm hằng số `public static final String STATUS_AI_PROCESSING = "ai_processing";` (mới, line ~51).
   - Tách `submitContent` (line 201-259) thành 2 phần:
     - `submitContent(username, contentId)` (giữ tên cho controller): chỉ validate quyền, set `status = "ai_processing"`, save, fire `ContentModerationRequestedEvent`. **Trả về `ContentResponse` ngay** trong transaction. Có thể xoay @Async hoặc giữ sync (vì giờ chỉ ~50ms).
     - Logic gọi AI + cập nhật status cuối → chuyển sang listener (xem #2).
   - Đảm bảo giữ nguyên rule nghiệp vụ: AI APPROVE → `published`; các decision khác → `under_review` (chờ admin).
   - Tương tự cho `submitVideo` (nếu có method riêng) — đảm bảo cùng pattern.

2. **`backend/src/main/java/com/fpt/swp391/nutribot/event/ContentModerationRequestedEvent.java`** *(file mới)*
   - Tạo event class tương tự `ContentPublishedEvent.java`: chứa `contentId`, `contentType` ("BLOG" | "VIDEO"), `authorId` (để log/notify).
   - Construct: `@Getter @RequiredArgsConstructor public class ContentModerationRequestedEvent { private final Long contentId; private final String contentType; private final Long authorId; }`.

3. **`backend/src/main/java/com/fpt/swp391/nutribot/listener/ContentModerationListener.java`** *(file mới, hoặc thêm method vào listener có sẵn)*
   - Annotation `@Component @RequiredArgsConstructor` (hoặc thêm vào `ContentRecipeSuggestionListener` nếu cùng concern).
   - Method `@EventListener @Async public void handleModerationRequested(ContentModerationRequestedEvent event) { ... }`:
     - Inject `ContentModerationGatewayService`, `ContentRepository` (hoặc `BlogRepository`/`VideoRepository`).
     - Gọi `gateway.moderateContent(contentId, contentType)` — đây là blocking call bên trong async, không ảnh hưởng request của user.
     - Dựa trên decision: APPROVE → set `published`; REJECT/NEEDS_REVIEW/lỗi → set `under_review`.
     - Save + lưu `content_moderations` record.
   - Wrap trong try/catch để đảm bảo exception không kill thread pool; log lỗi để debug.

4. **`backend/src/main/java/com/fpt/swp391/nutribot/event/ContentPublishedEvent.java`** *(chỉnh sửa nếu cần — không thay đổi logic)*
   - Không cần sửa file này. Listener cũ vẫn xử lý admin-approve path.

5. **`backend/src/test/java/com/fpt/swp391/nutribot/service/AuthorContentServiceTest.java`** *(cập nhật)*
   - Test case hiện tại test `submitContent` phải được điều chỉnh:
     - `submitContent_WhenValid_TransitionsToAiProcessingAndFiresEvent` (mới): mock `ApplicationEventPublisher`, gọi `submitContent`, verify status = `ai_processing`, event được publish, **không** gọi `ContentModerationGatewayService` nữa.
     - Test cũ về AI decision → chuyển sang test listener: `ContentModerationListenerTest.java` mới.

6. **`backend/src/test/java/com/fpt/swp391/nutribot/listener/ContentModerationListenerTest.java`** *(file mới)*
   - Test `handleModerationRequested_WhenAiApprove_SetsPublished`
   - Test `handleModerationRequested_WhenAiReject_KeepsUnderReview`
   - Test `handleModerationRequested_WhenAiTimeout_KeepsUnderReview`

### Frontend (React)

7. **`frontend/src/pages/CreateBlogPage.jsx`**
   - Sửa `submit(event, intent)` (line 521-585):
     - Sau call 2 (`submitForReview`), response sẽ trả `status = "ai_processing"` thay vì `published`/`under_review`.
     - **Clear `busy` ngay** khi call 2 về (line 568-579 sửa lại thứ tự: setBusy(false) TRƯỚC navigate).
     - Navigate sang `/community/my-blogs` mang theo state `{ justSubmittedId, justSubmittedType: 'ai_processing' }` để My Blogs highlight row vừa submit.
     - Toast/toast thông báo: "Đã nộp bài, hệ thống đang kiểm duyệt tự động".

8. **`frontend/src/pages/MyBlogsPage.jsx`** *(hoặc component tương đương — kiểm tra tên file thật)*
   - Thêm state `pollingIds: Set<number>` chứa các contentId đang ở `ai_processing`.
   - Effect: nếu `pollingIds.size > 0`, setInterval 3000ms gọi `GET /api/v1/author/blogs?ids=...` (hoặc loop từng id nếu backend chưa hỗ trợ batch) → cập nhật state, xoá khỏi set khi status đổi từ `ai_processing`.
   - Clear interval khi unmount.
   - Render: row có status `ai_processing` → badge `<span class="badge-pending">Đang kiểm duyệt <Spinner/></span>`, không cho click edit.

9. **`frontend/src/services/authorBlogApi.js`** *(hoặc tạo mới `contentStatusApi.js`)*
   - Thêm helper `getContentStatus(id, type)` gọi `GET /api/v1/author/blogs/{id}` hoặc `/api/v1/author/videos/{id}`.

10. **`frontend/src/components/content/MyBlogsRow.jsx`** *(hoặc inline trong MyBlogsPage)*
    - Thêm prop `isPolling` → render spinner nhỏ + disable nút Edit/Delete khi đang polling.

11. **`frontend/src/styles/create-blog.css` và `frontend/src/styles/my-blogs.css`** *(nếu có)*
    - Thêm class `.badge-pending { ... }` với spinner CSS animation (đã có thể tái sử dụng class `.loading` hiện có).

12. **Test FE** *(nếu chưa có test cho CreateBlogPage)*
    - Test `submit_FiresCallAndNavigatesImmediately_WhenApiRespondsQuickly` — mock API trả `ai_processing` ngay, verify `setBusy(false)` được gọi trước navigate.

### File không liên quan (giữ nguyên)

- `BlogAuthorController.java` / `VideoAuthorController.java`: không cần sửa API signature, vẫn `POST /{id}/submit` trả `ContentResponse` ngay.
- `ContentModerationGatewayService.java`: không sửa — vẫn là blocking call, nhưng giờ gọi từ listener thay vì service.
- `AdminModerationService.java`: không sửa.

## Implementation Steps

1. **Tạo branch mới** từ `master`:
   ```bash
   git checkout master
   git pull --ff-only  # hoặc rebase nếu lệch
   git checkout -b fix/post-async-ai-moderation
   ```

2. **BE - Tạo event** `ContentModerationRequestedEvent.java`.

3. **BE - Sửa `AuthorContentService.submitContent`**:
   - Set status = `ai_processing` thay vì `under_review`.
   - Fire `ContentModerationRequestedEvent`.
   - Trả `ContentResponse` ngay trong transaction hiện tại (xoay transaction hoặc giữ sync).
   - Bỏ toàn bộ logic gọi AI + cập nhật status cuối (chuyển sang listener).

4. **BE - Tạo `ContentModerationListener`**:
   - `@EventListener @Async` method `handleModerationRequested`.
   - Gọi `gateway.moderateContent` (giờ là async-safe, chạy trên thread pool).
   - Cập nhật status cuối + lưu moderation record.
   - Try/catch + log.

5. **BE - Cập nhật test `AuthorContentServiceTest.java`**: xoay assertion cho phù hợp flow mới (status = `ai_processing`, event được publish).

6. **BE - Tạo `ContentModerationListenerTest.java`**: test 3 case (APPROVE, REJECT, timeout).

7. **BE - Build + test**:
   ```bash
   cd backend
   ./mvnw test -Dtest='AuthorContentServiceTest,ContentModerationListenerTest'
   ./mvnw clean package -DskipTests
   ```

8. **FE - Sửa `CreateBlogPage.jsx`**:
   - Tách rõ `setBusy(false)` trước navigate.
   - Truyền state `{ justSubmittedId, status: 'ai_processing' }` qua navigate.

9. **FE - Sửa `MyBlogsPage.jsx`** *(tên file thật cần verify)*:
   - Effect polling với cleanup.
   - Render badge "Đang kiểm duyệt" + spinner.

10. **FE - Test thủ công** (theo AGENTS.md yêu cầu kiểm thử thực tế):
    - Start BE + FE.
    - Login author, tạo blog mới, bấm Post.
    - Verify: navigate về My Blogs trong < 1s, badge "Đang kiểm duyệt" xuất hiện, spinner xoay.
    - Sau 3-10s: badge đổi thành "Đã đăng" (nếu AI duyệt) hoặc "Chờ admin duyệt" (nếu AI reject/timeout).
    - Test với video cũng tương tự.
    - Test khi AI service tắt: AI timeout 30s → badge vẫn phải đổi từ `ai_processing` → `under_review` (không stuck).

11. **Commit & push**:
    ```bash
    git add backend/src/main/java/.../AuthorContentService.java \
            backend/src/main/java/.../event/ContentModerationRequestedEvent.java \
            backend/src/main/java/.../listener/ContentModerationListener.java \
            backend/src/test/java/.../AuthorContentServiceTest.java \
            backend/src/test/java/.../ContentModerationListenerTest.java \
            frontend/src/pages/CreateBlogPage.jsx \
            frontend/src/pages/MyBlogsPage.jsx \
            frontend/src/components/content/MyBlogsRow.jsx \
            frontend/src/services/authorBlogApi.js \
            frontend/src/styles/*.css
    git commit -m "fix(BE/FE): bất đồng bộ AI moderation khi submit post #done
    - Tách submitContent thành sync (set status + fire event) và async listener (gọi AI)
    - Thêm status mới ai_processing để FE polling
    - MyBlogsPage polling mỗi 3s cập nhật trạng thái bài vừa đăng
    - UX tác giả bấm Post là navigate ngay, không chờ AI"
    git push -u origin fix/post-async-ai-moderation
    ```

12. **Tạo PR** hướng vào `master`. Test lại end-to-end trên môi trường staging trước khi merge.

## Verification

- **BE:** `./mvnw test -Dtest='AuthorContentServiceTest,ContentModerationListenerTest'` → pass 100%.
- **BE build:** `./mvnw clean package -DskipTests` thành công.
- **FE:** `npx vitest run src/pages/CreateBlogPage` → pass (nếu có test).
- **Manual:** end-to-end như mô tả ở bước 10.
- **Edge case test:**
  - Tạo 5 bài liên tiếp nhanh → tất cả đều vào `ai_processing`, polling xử lý đồng thời.
  - User đóng tab khi đang polling → server vẫn xử lý AI (async), khi mở lại tab status đã cập nhật.
  - AI service down → 30s timeout → status chuyển `under_review` (không bị stuck `ai_processing`).

## Out of Scope

- Không thay đổi rule AI APPROVE/REJECT (giữ nguyên logic cũ).
- Không thêm WebSocket/SSE (polling đủ nhanh cho use case này).
- Không sửa `ContentModerationGatewayService` (vẫn là blocking HTTP, chỉ thay đổi caller).
- Không sửa admin moderation (NB-40) — chỉ sửa luồng author submit.
- Không xoá branch cũ, không dọn dẹp file plan cũ.
