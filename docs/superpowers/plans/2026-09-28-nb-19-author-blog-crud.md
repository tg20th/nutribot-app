# Author Blog CRUD & Thumbnail Upload Backend (NB-19) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng và hoàn thiện Author Blog CRUD và Backend upload thumbnail, áp dụng kiểm tra nghiêm ngặt Ownership, Category Guard, State Machine bảo đảm tính toàn vẹn (Audit Gaps BL-005, BL-006, BL-013, BL-020).

**Architecture:** Tạo `CloudinaryMediaService` và `BlogThumbnailController` quản lý thumbnail độc lập cho Blog; chuẩn hóa `AuthorContentService` với các guard kiểm tra danh tính Principal (chống IDOR), máy trạng thái chặt chẽ (`DRAFT ↔ UNDER_REVIEW`, hạ bài về nháp khi sửa bài đã duyệt), xác thực danh mục `RECIPE` đang active, sinh slug tiếng Việt chuẩn hoá khử dấu, và cơ chế dọn dẹp orphan media trên Cloudinary.

**Tech Stack:** Java 25, Spring Boot 3.x, Spring Data JPA, Spring Security, Cloudinary HTTP5, JUnit 5, Mockito.

**Spec:** [`docs/superpowers/specs/2026-09-28-nb-19-author-blog-crud-design.md`](file:///c:/Users/PC/Documents/26FA/SWP391/Project/swp391_group7_nutribot/docs/superpowers/specs/2026-09-28-nb-19-author-blog-crud-design.md)

## Global Constraints

- Commit message 100% Tiếng Việt theo chuẩn Git 50/72 có gắn mã task `#done` và `Closes NB-19`.
- Định dạng API Response chuẩn `ApiResponse<T>`.
- Trả về `NotFoundException` (HTTP 404) khi ID không tồn tại.
- Trả về `ForbiddenException` (HTTP 403) khi người dùng không phải chủ sở hữu bài viết (ngăn chặn IDOR).
- Trả về `BadRequestException` (HTTP 400) khi dữ liệu danh mục không hợp lệ hoặc tác giả cố tình gửi trạng thái `published`/`rejected`.
- Luôn trích xuất danh tính tác giả từ SecurityContext (`UserDetails`), không tin cậy `authorId` từ request payload.

## Review Focus

1. **Crafted authorId bypass:** Client gửi body JSON cố tình chèn `authorId: 999` hoặc `userId: 999` ➔ Hệ thống tuyệt đối bỏ qua và gán đúng User ID từ token đăng nhập.
2. **State tampering:** Tác giả gửi `PUT /api/v1/author/blogs/{id}` với body `{"status": "published"}` ➔ Hệ thống từ chối ngay với HTTP 400 (`BadRequestException`).
3. **Ghost category assignment:** Tác giả gán `categoryId` của danh mục nguyên liệu (`category_type = 'INGREDIENT'`) hoặc danh mục đã bị vô hiệu hóa (`is_active = false`) ➔ Hệ thống từ chối với HTTP 400.
4. **Cloudinary error cascade:** Khi Cloudinary gặp sự cố mạng hoặc lỗi khi xóa thumbnail cũ trong lúc xóa bài viết ➔ Giao dịch xóa trong Database vẫn thành công bình thường (fault-tolerant orphan cleanup).
5. **Vietnamese slug integrity:** Tiêu đề tiếng Việt có dấu được khử dấu chính xác (không bị nuốt chữ cái) và không gây lỗi 500 do vi phạm ràng buộc Unique trong CSDL.

---

### Task 1: CloudinaryMediaService & BlogThumbnailController

**Files:**
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/service/CloudinaryMediaService.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/controller/BlogThumbnailController.java`
- Create: `backend/src/test/java/com/fpt/swp391/nutribot/service/CloudinaryMediaServiceTest.java`

**Interfaces:**
- Consumes: `Cloudinary` bean, `MultipartFile`, `@Value("${cloudinary.cloud-name:}")`, `@Value("${cloudinary.api-key:}")`, `@Value("${cloudinary.api-secret:}")`
- Produces: 
  - `CloudinaryMediaService.uploadThumbnail(MultipartFile file, Integer userId)` ➔ `MediaUploadResult(String secureUrl, String publicId)`
  - `CloudinaryMediaService.deleteThumbnailByUrl(String secureUrl)` ➔ `void`
  - `POST /api/v1/blogs/thumbnails` và `POST /api/v1/author/blogs/thumbnail` ➔ `ApiResponse<Map<String, String>>` với key `thumbnailUrl`

- [ ] **Step 1: Viết test cho CloudinaryMediaService**

Tạo file `backend/src/test/java/com/fpt/swp391/nutribot/service/CloudinaryMediaServiceTest.java`:
```java
package com.fpt.swp391.nutribot.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử CloudinaryMediaService (Upload Thumbnail & Orphan Cleanup)")
class CloudinaryMediaServiceTest {

    @Mock
    private Cloudinary cloudinary;

    @Mock
    private Uploader uploader;

    private CloudinaryMediaService mediaService;

    @BeforeEach
    void setUp() {
        mediaService = new CloudinaryMediaService(
                cloudinary,
                "test-cloud",
                "test-key",
                "test-secret"
        );
    }

    @Test
    @DisplayName("Upload thumbnail thành công khi file hợp lệ")
    void uploadThumbnail_validFile_success() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "cover.jpg", "image/jpeg", new byte[]{1, 2, 3, 4}
        );
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), anyMap())).thenReturn(Map.of(
                "secure_url", "https://res.cloudinary.com/test-cloud/image/upload/nutribot/thumbnails/thumb_1_abc.jpg",
                "public_id", "nutribot/thumbnails/thumb_1_abc"
        ));

        CloudinaryMediaService.MediaUploadResult result = mediaService.uploadThumbnail(file, 1);

        assertNotNull(result);
        assertEquals("https://res.cloudinary.com/test-cloud/image/upload/nutribot/thumbnails/thumb_1_abc.jpg", result.secureUrl());
    }

    @Test
    @DisplayName("Từ chối upload khi file rỗng")
    void uploadThumbnail_emptyFile_throwsBadRequest() {
        MockMultipartFile file = new MockMultipartFile("file", "", "image/jpeg", new byte[0]);
        assertThrows(BadRequestException.class, () -> mediaService.uploadThumbnail(file, 1));
    }

    @Test
    @DisplayName("Từ chối upload khi file sai định dạng MIME")
    void uploadThumbnail_invalidMime_throwsBadRequest() {
        MockMultipartFile file = new MockMultipartFile("file", "script.exe", "application/octet-stream", new byte[]{1, 2, 3});
        assertThrows(BadRequestException.class, () -> mediaService.uploadThumbnail(file, 1));
    }

    @Test
    @DisplayName("Xóa thumbnail an toàn theo URL")
    void deleteThumbnailByUrl_validUrl_callsCloudinaryDestroy() throws Exception {
        when(cloudinary.uploader()).thenReturn(uploader);
        String url = "https://res.cloudinary.com/test-cloud/image/upload/nutribot/thumbnails/thumb_1_abc.jpg";

        assertDoesNotThrow(() -> mediaService.deleteThumbnailByUrl(url));
        verify(uploader).destroy(eq("nutribot/thumbnails/thumb_1_abc"), anyMap());
    }

    @Test
    @DisplayName("Bỏ qua xóa an toàn khi URL không thuộc Cloudinary của hệ thống")
    void deleteThumbnailByUrl_externalUrl_ignoredSafely() {
        String externalUrl = "https://images.unsplash.com/photo-123456";
        assertDoesNotThrow(() -> mediaService.deleteThumbnailByUrl(externalUrl));
        verifyNoInteractions(cloudinary);
    }
}
```

- [ ] **Step 2: Chạy kiểm thử để xác nhận thất bại**

Run: `.\mvnw.cmd test -Dtest=CloudinaryMediaServiceTest`
Expected: FAIL vì `CloudinaryMediaService` chưa được tạo.

- [ ] **Step 3: Viết triển khai `CloudinaryMediaService` và `BlogThumbnailController`**

Tạo file `backend/src/main/java/com/fpt/swp391/nutribot/service/CloudinaryMediaService.java`:
```java
package com.fpt.swp391.nutribot.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
public class CloudinaryMediaService {

    private static final String THUMBNAIL_FOLDER = "nutribot/thumbnails";
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    private static final List<String> ALLOWED_MIME_TYPES = List.of(
            "image/jpeg",
            "image/png",
            "image/webp"
    );

    private final Cloudinary cloudinary;
    private final String cloudName;
    private final String apiKey;
    private final String apiSecret;

    public CloudinaryMediaService(
            Cloudinary cloudinary,
            @Value("${cloudinary.cloud-name:}") String cloudName,
            @Value("${cloudinary.api-key:}") String apiKey,
            @Value("${cloudinary.api-secret:}") String apiSecret) {
        this.cloudinary = cloudinary;
        this.cloudName = cloudName != null ? cloudName.trim() : "";
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.apiSecret = apiSecret != null ? apiSecret.trim() : "";
    }

    public MediaUploadResult uploadThumbnail(MultipartFile file, Integer userId) {
        ensureConfigured();

        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Vui lòng chọn hình ảnh để tải lên");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("Dung lượng ảnh thu nhỏ không được vượt quá 5MB");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
            throw new BadRequestException("Chỉ chấp nhận định dạng ảnh JPG, PNG hoặc WebP");
        }

        if (userId == null) {
            throw new BadRequestException("Thông tin người dùng không hợp lệ");
        }

        String publicId = "thumb_" + userId + "_" + UUID.randomUUID().toString().replace("-", "");
        try {
            Map<?, ?> result = cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
                    "resource_type", "image",
                    "folder", THUMBNAIL_FOLDER,
                    "public_id", publicId,
                    "overwrite", false
            ));

            Object secureUrl = result.get("secure_url");
            Object uploadedPublicId = result.get("public_id");
            if (!(secureUrl instanceof String url) || !(uploadedPublicId instanceof String id)) {
                throw new IllegalStateException("Cloudinary không trả về URL ảnh hợp lệ.");
            }
            return new MediaUploadResult(url, id);
        } catch (IOException ex) {
            log.error("Lỗi khi đọc file ảnh: ", ex);
            throw new BadRequestException("Không thể đọc tệp ảnh tải lên");
        } catch (Exception ex) {
            log.error("Lỗi khi tải ảnh lên Cloudinary: ", ex);
            throw new BadRequestException("Tải ảnh thu nhỏ thất bại. Vui lòng thử lại sau.");
        }
    }

    public void deleteThumbnailByUrl(String secureUrl) {
        if (secureUrl == null || secureUrl.isBlank()) {
            return;
        }
        if (cloudName.isBlank() || apiKey.isBlank() || apiSecret.isBlank()) {
            return;
        }

        try {
            URI uri = URI.create(secureUrl);
            String expectedPrefix = "/" + cloudName + "/image/upload/";
            String path = uri.getPath();
            if (!"res.cloudinary.com".equalsIgnoreCase(uri.getHost()) || path == null || !path.startsWith(expectedPrefix)) {
                return;
            }

            String assetPath = path.substring(expectedPrefix.length());
            if (assetPath.matches("v\\d+/.+")) {
                assetPath = assetPath.substring(assetPath.indexOf('/') + 1);
            }
            String thumbPrefix = THUMBNAIL_FOLDER + "/";
            if (!assetPath.startsWith(thumbPrefix)) {
                return;
            }

            String publicId = assetPath.substring(0, assetPath.lastIndexOf('.') >= 0
                    ? assetPath.lastIndexOf('.')
                    : assetPath.length());

            cloudinary.uploader().destroy(publicId, ObjectUtils.asMap("resource_type", "image"));
            log.info("Đã dọn dẹp ảnh thumbnail cũ trên Cloudinary: {}", publicId);
        } catch (Exception ex) {
            log.warn("Không thể xóa ảnh thumbnail trên Cloudinary (url: {}): {}", secureUrl, ex.getMessage());
        }
    }

    private void ensureConfigured() {
        if (cloudName.isBlank() || apiKey.isBlank() || apiSecret.isBlank()) {
            throw new BadRequestException("Hệ thống lưu trữ ảnh chưa được cấu hình. Vui lòng liên hệ quản trị viên.");
        }
    }

    public record MediaUploadResult(String secureUrl, String publicId) {
    }
}
```

Tạo file `backend/src/main/java/com/fpt/swp391/nutribot/controller/BlogThumbnailController.java`:
```java
package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.service.CloudinaryMediaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class BlogThumbnailController {

    private final CloudinaryMediaService cloudinaryMediaService;
    private final UserRepository userRepository;

    @PostMapping({"/api/v1/blogs/thumbnails", "/api/v1/author/blogs/thumbnail"})
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadThumbnail(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam("file") MultipartFile file) {

        if (userDetails == null) {
            throw new BadRequestException("Vui lòng đăng nhập để tải ảnh lên");
        }

        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        CloudinaryMediaService.MediaUploadResult result = cloudinaryMediaService.uploadThumbnail(file, user.getUserId());
        return ResponseEntity.ok(ApiResponse.success(
                "Tải ảnh thu nhỏ lên thành công",
                Map.of("thumbnailUrl", result.secureUrl())
        ));
    }
}
```

- [ ] **Step 4: Chạy kiểm thử để xác nhận thành công**

Run: `.\mvnw.cmd test -Dtest=CloudinaryMediaServiceTest`
Expected: PASS 100%.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/fpt/swp391/nutribot/service/CloudinaryMediaService.java backend/src/main/java/com/fpt/swp391/nutribot/controller/BlogThumbnailController.java backend/src/test/java/com/fpt/swp391/nutribot/service/CloudinaryMediaServiceTest.java
git commit -m "feat(NB-19-BE): xây dựng CloudinaryMediaService và API upload thumbnail

- Tạo CloudinaryMediaService hỗ trợ upload và xóa an toàn orphan thumbnail
- Thêm BlogThumbnailController đáp ứng POST /api/v1/blogs/thumbnails và alias
- Viết CloudinaryMediaServiceTest kiểm thử 5 ca thành công và từ chối an toàn"
```

---

### Task 2: DTOs Allowlist & Validation Hardening

**Files:**
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/dto/request/ContentCreateRequest.java`
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/dto/request/ContentUpdateRequest.java`

**Interfaces:**
- Consumes: Jakarta Bean Validation (`@NotBlank`, `@Size`, `@Pattern`)
- Produces: Safe request models excluding any author/moderation tampering fields.

- [ ] **Step 1: Cập nhật `ContentCreateRequest`**

Cập nhật file `backend/src/main/java/com/fpt/swp391/nutribot/dto/request/ContentCreateRequest.java`:
```java
package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContentCreateRequest {

    @NotBlank(message = "Tiêu đề không được để trống")
    @Size(max = 255, message = "Tiêu đề không được vượt quá 255 ký tự")
    private String title;

    private String body;

    private Integer categoryId;

    @Size(max = 500, message = "Đường dẫn media không được vượt quá 500 ký tự")
    private String mediaUrl;

    @Size(max = 500, message = "Đường dẫn thumbnail không được vượt quá 500 ký tự")
    private String thumbnailUrl;

    private Integer durationSec;
}
```

- [ ] **Step 2: Cập nhật `ContentUpdateRequest`**

Cập nhật file `backend/src/main/java/com/fpt/swp391/nutribot/dto/request/ContentUpdateRequest.java`:
```java
package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContentUpdateRequest {

    @Size(max = 255, message = "Tiêu đề không được vượt quá 255 ký tự")
    private String title;

    private String body;

    private Integer categoryId;

    @Size(max = 500, message = "Đường dẫn media không được vượt quá 500 ký tự")
    private String mediaUrl;

    @Size(max = 500, message = "Đường dẫn thumbnail không được vượt quá 500 ký tự")
    private String thumbnailUrl;

    private Integer durationSec;

    private String status;
}
```

- [ ] **Step 3: Biên dịch dự án xác nhận không phát sinh lỗi compile**

Run: `.\mvnw.cmd test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/fpt/swp391/nutribot/dto/request/ContentCreateRequest.java backend/src/main/java/com/fpt/swp391/nutribot/dto/request/ContentUpdateRequest.java
git commit -m "refactor(NB-19-BE): chuẩn hóa DTO allowlist và validation cho Content

- Giới hạn độ dài URL và tiêu đề trong ContentCreateRequest và ContentUpdateRequest
- Bảo đảm loại bỏ hoàn toàn các trường authorId và moderation tampering"
```

---

### Task 3: AuthorContentService Hardening (Ownership, State Machine, Category Guard, Slug & Cleanup)

**Files:**
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/service/AuthorContentService.java`
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/repository/ContentRepository.java`

**Interfaces:**
- Consumes: `CategoryRepository`, `CloudinaryMediaService`, `UserRepository`, `ContentRepository`
- Produces:
  - `submitContent(String username, Integer contentId)` ➔ `AuthorContentResponse`
  - `recallContent(String username, Integer contentId)` ➔ `AuthorContentResponse`
  - `createContent(String username, String contentType, ContentCreateRequest request)` ➔ `AuthorContentResponse`
  - `updateContent(String username, Integer contentId, ContentUpdateRequest request)` ➔ `AuthorContentResponse`
  - `deleteContent(String username, Integer contentId)` ➔ `void`

- [ ] **Step 1: Bổ sung query hỗ trợ trong `ContentRepository` (nếu cần)**

Kiểm tra và bổ sung `existsBySlug(String slug)` vào `backend/src/main/java/com/fpt/swp391/nutribot/repository/ContentRepository.java`:
```java
boolean existsBySlug(String slug);
```

- [ ] **Step 2: Nâng cấp toàn diện `AuthorContentService`**

Chỉnh sửa file `backend/src/main/java/com/fpt/swp391/nutribot/service/AuthorContentService.java`:
- Tiêm phụ thuộc `CategoryRepository` và `CloudinaryMediaService`.
- Xây dựng thuật toán sinh slug tiếng Việt khử dấu qua `java.text.Normalizer`.
- Thêm hàm `validateCategory(Integer categoryId)`.
- Triển khai State Machine:
  - `createContent`: luôn khởi tạo `status = "draft"`.
  - `updateContent`:
    - Nếu `content.getStatus()` là `published` hoặc `rejected`: tự động hạ về `draft` (trừ khi yêu cầu explicit `under_review`).
    - Nếu tác giả gửi `status`: chỉ cho phép `"draft"` hoặc `"under_review"`. Bất kỳ giá trị nào khác (kể cả `published`, `rejected`, `flagged`, `archived`) đều ném `BadRequestException("Tác giả không có quyền chuyển sang trạng thái này")`.
  - `submitContent`: chuyển bài từ `draft` ➔ `under_review`.
  - `recallContent`: chuyển bài từ `under_review` ➔ `draft`.
  - `deleteContent`: dọn dẹp thumbnail trên Cloudinary an toàn trước khi xóa entity.
  - Sử dụng đúng `NotFoundException` (404) khi ID không tồn tại và `ForbiddenException` (403) khi không phải tác giả sở hữu.

- [ ] **Step 3: Biên dịch thử nghiệm**

Run: `.\mvnw.cmd test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/fpt/swp391/nutribot/service/AuthorContentService.java backend/src/main/java/com/fpt/swp391/nutribot/repository/ContentRepository.java
git commit -m "feat(NB-19-BE): nâng cấp State Machine, Ownership Guard và Category Validation

- Bổ sung xác thực danh mục RECIPE active và sinh slug tiếng Việt chuẩn
- Triển khai State Machine bảo mật cấm author set published/rejected
- Tự động hạ trạng thái về draft khi sửa bài published hoặc rejected
- Thêm submitContent và recallContent phục vụ quy trình gửi duyệt"
```

---

### Task 4: BlogAuthorController Endpoint Extensions

**Files:**
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/controller/BlogAuthorController.java`

**Interfaces:**
- Consumes: `AuthorContentService`
- Produces:
  - `POST /api/v1/author/blogs/{id}/submit` ➔ `ApiResponse<AuthorContentResponse>`
  - `POST /api/v1/author/blogs/{id}/recall` ➔ `ApiResponse<AuthorContentResponse>`

- [ ] **Step 1: Bổ sung 2 endpoints submit và recall**

Cập nhật `backend/src/main/java/com/fpt/swp391/nutribot/controller/BlogAuthorController.java`:
```java
    @PostMapping("/{id}/submit")
    public ResponseEntity<ApiResponse<AuthorContentResponse>> submitBlog(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer id) {
        AuthorContentResponse response = authorContentService.submitContent(user.getUsername(), id);
        return ResponseEntity.ok(ApiResponse.success("Nộp bài viết chờ duyệt thành công", response));
    }

    @PostMapping("/{id}/recall")
    public ResponseEntity<ApiResponse<AuthorContentResponse>> recallBlog(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer id) {
        AuthorContentResponse response = authorContentService.recallContent(user.getUsername(), id);
        return ResponseEntity.ok(ApiResponse.success("Rút bài viết về bản nháp thành công", response));
    }
```

- [ ] **Step 2: Biên dịch xác nhận không lỗi**

Run: `.\mvnw.cmd test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/fpt/swp391/nutribot/controller/BlogAuthorController.java
git commit -m "feat(NB-19-BE): thêm endpoint submit và recall cho tác giả blog

- Bổ sung POST /api/v1/author/blogs/{id}/submit gửi duyệt bài viết
- Bổ sung POST /api/v1/author/blogs/{id}/recall rút bài về bản nháp"
```

---

### Task 5: AuthorContentServiceTest - Comprehensive Unit & Security Test Suite

**Files:**
- Create: `backend/src/test/java/com/fpt/swp391/nutribot/service/AuthorContentServiceTest.java`

**Interfaces:**
- Consumes: JUnit 5, Mockito, `AuthorContentService`, `ContentRepository`, `UserRepository`, `CategoryRepository`, `CloudinaryMediaService`
- Produces: Bộ 13 Unit test cases kiểm thử tự động đạt 100% PASS.

- [ ] **Step 1: Viết 13 Unit Test Cases toàn diện**

Tạo file `backend/src/test/java/com/fpt/swp391/nutribot/service/AuthorContentServiceTest.java` bao phủ đầy đủ:
1. `createContent_success_setsDraftAndUserFromPrincipal`
2. `updateContent_ownerSuccess`
3. `updateContent_nonOwner_throwsForbidden`
4. `deleteContent_nonOwner_throwsForbidden`
5. `getContentById_nonOwner_throwsForbidden`
6. `getContentById_notFound_throwsNotFound`
7. `updateContent_publishedOrRejected_resetsToDraft`
8. `updateContent_invalidStatusTransition_throwsBadRequest`
9. `submitContent_transitionsToUnderReview`
10. `recallContent_transitionsToDraft`
11. `createContent_invalidCategoryTypeOrInactive_throwsBadRequest`
12. `deleteContent_cleansUpCloudinaryThumbnail`
13. `generateSlug_handlesVietnameseDiacritics`

- [ ] **Step 2: Chạy kiểm thử AuthorContentServiceTest**

Run: `.\mvnw.cmd test -Dtest=AuthorContentServiceTest`
Expected: Tests run: 13, Failures: 0, Errors: 0, Skipped: 0.

- [ ] **Step 3: Chạy toàn bộ backend test suite**

Run: `.\mvnw.cmd test`
Expected: Toàn bộ các test suite (AuthController, ContentService, HomeService, SearchService, UserProfile, TokenBlacklist, AuthorContent, CloudinaryMedia) đều **BUILD SUCCESS (100% PASS)**.

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/java/com/fpt/swp391/nutribot/service/AuthorContentServiceTest.java
git commit -m "test(NB-19-BE): hoàn thành bộ 13 unit tests kiểm thử Author Blog CRUD #done

- Kiểm thử chống IDOR và xác thực quyền sở hữu (BL-005)
- Kiểm thử State Machine cấm author can thiệp status (BL-006)
- Kiểm thử Category Guard và dọn dẹp orphan media (BL-013, BL-020)
- Kiểm thử sinh slug tiếng Việt chuẩn xác"
```
