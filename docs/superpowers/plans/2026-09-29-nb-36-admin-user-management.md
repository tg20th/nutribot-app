# Kế hoạch triển khai: Admin User Management API (NB-36)

> **Dành cho Agent/Developer thực thi:** BẮT BUỘC sử dụng sub-skill `superpowers:executing-plans` hoặc `superpowers:subagent-driven-development` để thực hiện từng bước. Mỗi task tuân thủ nghiêm ngặt Test-Driven Development (TDD) và quy chuẩn Git 50/72 bằng tiếng Việt.

**Mã Task Jira:** `NB-36`  
**Thành viên phụ trách:** Trường (Backend)  
**Goal:** Xây dựng và hoàn thiện Admin User Management API (`GET /api/v1/admin/users`, `PUT /api/v1/admin/users/{userId}/status`) hỗ trợ tìm kiếm/lọc/phân trang chuẩn 100% tại tầng CSDL, áp dụng Canonical State Machine chặt chẽ, bảo vệ an toàn Quản trị viên (chống self-ban, bảo vệ last admin), triệt tiêu xung đột DB trigger và đồng bộ hiệu lực tức thời lên JWT token (Audit Gaps BL-003, BL-015, BL-022, BL-031).  

**Kiến trúc:**  
- **Controller & Security:** `AdminUserController` áp dụng `@PreAuthorize("hasRole('ADMIN')")` và deny-by-default qua `SecurityConfig`.  
- **Database Query:** Dùng Spring Data JPA `JpaSpecificationExecutor<User>` và `UserSpecifications` để filter (keyword trên username, email, fullName; status) và count trực tiếp tại CSDL với `Pageable` bị giới hạn (`bounded page size <= 50`).  
- **State Machine & Guards:** `AdminUserService` kiểm soát các chuyển đổi trạng thái hợp lệ giữa `ACTIVE`, `WARN`, `SUSPENDED`, `BANNED`, cấm tự khóa tài khoản chính mình (Self-Ban Guard) và cấm khóa Admin duy nhất còn lại (Last Admin Guard).  
- **DB Trigger Alignment:** Sửa trigger `TR_users_auto_update_status_by_strike` trong `Database.sql` để không ghi đè trạng thái `SUSPENDED` do Admin chỉ định.  

**Tech Stack:** Java 25, Spring Boot 3.x, Spring Data JPA, Spring Security 6, Hibernate, JUnit 5, Mockito, AssertJ.  

---

## Global Constraints

- **Response Wrapper:** Mọi endpoint trả về HTTP 200/400/403/404 đều bọc trong `ApiResponse<T>` chuẩn hóa của dự án.
- **Commit Messages:** 100% tiếng Việt theo chuẩn Git 50/72: `feat(NB-36-BE): ... [#done]` hoặc `fix(NB-36-BE): ...`.
- **Database Entities:** Khớp chính xác bảng `users` trong `Database.sql`, enum `AccountStatus` (`ACTIVE`, `WARN`, `SUSPENDED`, `BANNED`, `PENDING_VERIFY`).
- **Pagination Boundary:** Page size tối thiểu 1, tối đa 50 (mặc định 10). Page index 0-based.
- **Authorization:** Chỉ người dùng có role `ROLE_ADMIN` mới được phép gọi các endpoint này. Bất kỳ role nào khác đều nhận HTTP 403 Forbidden.

---

## Review Focus (5 Trọng tâm Kiểm toán & Rủi ro Tiềm ẩn)

1. **DB Trigger Overwrite (BL-031):** Khi Admin set `status = SUSPENDED` cho user có `strikeCount = 0`, trigger CSDL không được phép ghi đè ngược về `ACTIVE`.
2. **Broken Memory Pagination:** Tuyệt đối không query `findAll(pageable)` rồi mới filter bằng Java Stream. Mọi điều kiện tìm kiếm và tính tổng số lượng (`totalElements`, `totalPages`) phải thực hiện bằng câu lệnh SQL tại Database.
3. **Admin Self-Ban Prevention (BL-022):** Quản trị viên đang đăng nhập không thể tự thay đổi trạng thái hoặc ban chính tài khoản của mình.
4. **Last Active Admin Protection (BL-022):** Không cho phép ban/suspend tài khoản Quản trị viên duy nhất còn đang `ACTIVE` trong toàn hệ thống.
5. **Invalid State Transition & Fake Statuses (BL-015):** Từ chối ngay các status không có trong schema như `DELETED`, và ngăn chặn kích hoạt thẳng tài khoản `PENDING_VERIFY` lên `ACTIVE` khi chưa xác thực OTP.

---

## Kế hoạch triển khai từng Task

### Task 1: Đồng bộ Database Trigger & Schema Alignment (BL-031)

**Files:**
- Modify: `backend/sql/Database.sql:58-77`
- Modify: `backend/sql/seed.sql` (nếu có cập nhật dữ liệu mẫu)

**Interfaces:**
- Input: Bảng `users`, trigger `TR_users_auto_update_status_by_strike`.
- Output: Trigger tôn trọng trạng thái `SUSPENDED` do Admin chỉ định, chỉ tự động can thiệp khi cập nhật strike count thông thường.

- [ ] **Step 1: Cập nhật file `backend/sql/Database.sql`**
Cập nhật điều kiện trigger để bảo lưu cả `SUSPENDED`:
```sql
-- Trigger tự động cập nhật status theo strike_count
CREATE TRIGGER TR_users_auto_update_status_by_strike
ON users
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE u
    SET status = CASE
                    WHEN i.status IN (N'BANNED', N'SUSPENDED', N'PENDING_VERIFY') THEN i.status
                    WHEN i.strike_count >= 3 THEN N'SUSPENDED'
                    WHEN i.strike_count BETWEEN 1 AND 2 THEN N'WARN'
                    ELSE N'ACTIVE'
                 END,
        updated_at = SYSUTCDATETIME()
    FROM users u
    INNER JOIN inserted i ON u.user_id = i.user_id;
END;
GO
```

- [ ] **Step 2: Commit thay đổi Database.sql**
```bash
git add backend/sql/Database.sql
git commit -m "fix(NB-36-BE): đồng bộ trigger users không ghi đè SUSPENDED

- Cập nhật trigger TR_users_auto_update_status_by_strike
- Bảo lưu trạng thái SUSPENDED do Quản trị viên chỉ định
- Đóng lỗ hổng xung đột quyền lực giữa DB Trigger và Service (BL-031)"
```

---

### Task 2: Chuẩn hóa DTO và Ràng buộc Kiểm thực (BL-015, BL-031)

**Files:**
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/dto/request/AdminUserStatusRequest.java`
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/dto/response/AdminUserResponse.java`

**Interfaces:**
- Consumes: JSON Request Payload `{ "status": "BANNED", "reason": "Vi phạm điều khoản cộng đồng" }`.
- Produces: DTO hợp lệ với validation `@NotBlank`, `@Pattern` khớp enum `AccountStatus` và trường `reason` phục vụ Audit.

- [ ] **Step 1: Cập nhật `AdminUserStatusRequest.java`**
Loại bỏ `DELETED`, bổ sung `WARN`, thêm trường `reason`:
```java
package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminUserStatusRequest {

    @NotBlank(message = "Trạng thái tài khoản không được để trống")
    @Pattern(regexp = "ACTIVE|WARN|SUSPENDED|BANNED",
             message = "Trạng thái chỉ được là ACTIVE, WARN, SUSPENDED hoặc BANNED")
    private String status;

    @Size(max = 255, message = "Lý do thay đổi trạng thái tối đa 255 ký tự")
    private String reason;
}
```

- [ ] **Step 2: Cập nhật `AdminUserResponse.java`**
Bổ sung các trường hữu ích cho UI quản trị:
```java
package com.fpt.swp391.nutribot.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserResponse {

    private Integer userId;
    private String username;
    private String email;
    private String fullName;
    private String avatarUrl;
    private String roleName;
    private String status;
    private Integer strikeCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

- [ ] **Step 3: Commit DTOs**
```bash
git add backend/src/main/java/com/fpt/swp391/nutribot/dto/request/AdminUserStatusRequest.java backend/src/main/java/com/fpt/swp391/nutribot/dto/response/AdminUserResponse.java
git commit -m "feat(NB-36-BE): chuẩn hóa DTO quản trị tài khoản và audit

- Bổ sung trường reason phục vụ kiểm toán thay đổi trạng thái
- Đồng bộ regex trạng thái hợp lệ loại bỏ giá trị rác DELETED
- Bổ sung avatarUrl và updatedAt vào AdminUserResponse"
```

---

### Task 3: Xây dựng Dynamic Query tầng CSDL với Spring Data Specification

**Files:**
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/repository/specification/UserSpecifications.java`
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/repository/UserRepository.java`

**Interfaces:**
- Consumes: `keyword` (String), `status` (AccountStatus).
- Produces: `Specification<User>` lọc và count trực tiếp tại DB qua câu lệnh SQL WHERE.
- `UserRepository`: Kế thừa `JpaSpecificationExecutor<User>`, bổ sung method `countByRoleRoleNameAndStatus`.

- [ ] **Step 1: Cập nhật `UserRepository.java`**
Kế thừa `JpaSpecificationExecutor<User>` và thêm hàm đếm Admin:
```java
// Trong UserRepository.java
public interface UserRepository extends JpaRepository<User, Integer>, JpaSpecificationExecutor<User> {
    ...
    long countByRoleRoleNameAndStatus(String roleName, AccountStatus status);
}
```

- [ ] **Step 2: Tạo class `UserSpecifications.java`**
```java
package com.fpt.swp391.nutribot.repository.specification;

import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.User;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public class UserSpecifications {

    public static Specification<User> withFilter(String keyword, AccountStatus status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (keyword != null && !keyword.isBlank()) {
                String pattern = "%" + keyword.trim().toLowerCase() + "%";
                Predicate usernameMatch = cb.like(cb.lower(root.get("username")), pattern);
                Predicate emailMatch = cb.like(cb.lower(root.get("email")), pattern);
                Predicate fullNameMatch = cb.like(cb.lower(root.get("fullName")), pattern);
                predicates.add(cb.or(usernameMatch, emailMatch, fullNameMatch));
            }

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
```

- [ ] **Step 3: Commit Specification & Repository**
```bash
git add backend/src/main/java/com/fpt/swp391/nutribot/repository/specification/UserSpecifications.java backend/src/main/java/com/fpt/swp391/nutribot/repository/UserRepository.java
git commit -m "feat(NB-36-BE): xây dựng Specification phân trang lọc user ở DB

- Kế thừa JpaSpecificationExecutor trong UserRepository
- Cung cấp UserSpecifications lọc keyword và status trực tiếp trên SQL
- Bổ sung hàm countByRoleRoleNameAndStatus bảo vệ last admin"
```

---

### Task 4: Triển khai State Machine & Quản trị An toàn trong `AdminUserService` (BL-015, BL-022, BL-031)

**Files:**
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/service/AdminUserService.java`

**Business Rules & State Machine:**
1. **Phân trang an toàn:** Giới hạn `pageSize = Math.min(Math.max(size, 1), 50)`. Sắp xếp `createdAt DESC, userId DESC`.
2. **Self-Ban Guard:** So sánh `currentAdminUsername` với `targetUser.getUsername()`. Nếu trùng ➔ Ném `BadRequestException("Bạn không thể tự thay đổi trạng thái tài khoản của chính mình")`.
3. **Last Admin Guard:** Nếu `targetUser.getRole().getRoleName().equalsIgnoreCase("ADMIN")` và chuyển sang `BANNED` hoặc `SUSPENDED`:
   Kiểm tra số lượng Admin đang `ACTIVE` trong hệ thống. Nếu `<= 1` ➔ Ném `BadRequestException("Không thể khóa tài khoản Quản trị viên duy nhất còn lại trong hệ thống")`.
4. **Transition Rules:**
   - Không cho phép chuyển tài khoản `PENDING_VERIFY` thành `ACTIVE` (phải xác thực OTP).
   - Nếu chuyển từ `SUSPENDED`/`BANNED` về `ACTIVE`, có thể đồng bộ `strikeCount` an toàn.
   - Ghi log SLF4J chi tiết: `Admin [{}] changed user [{}] status from [{}] to [{}], reason: [{}]`.

- [ ] **Step 1: Viết `AdminUserService.java` hoàn chỉnh**
```java
package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.AdminUserStatusRequest;
import com.fpt.swp391.nutribot.dto.response.AdminUserResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.repository.specification.UserSpecifications;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private static final int MAX_PAGE_SIZE = 50;
    private static final int DEFAULT_PAGE_SIZE = 10;

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public PagedResponse<AdminUserResponse> getAllUsers(String keyword, String statusStr, int page, int size) {
        int boundedPage = Math.max(page, 0);
        int boundedSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);

        AccountStatus statusFilter = null;
        if (statusStr != null && !statusStr.isBlank()) {
            try {
                statusFilter = AccountStatus.fromString(statusStr);
            } catch (IllegalArgumentException e) {
                log.warn("Trạng thái lọc không hợp lệ: {}", statusStr);
            }
        }

        Pageable pageable = PageRequest.of(boundedPage, boundedSize, Sort.by(Sort.Direction.DESC, "createdAt", "userId"));
        Specification<User> spec = UserSpecifications.withFilter(keyword, statusFilter);
        Page<User> userPage = userRepository.findAll(spec, pageable);

        var responses = userPage.getContent().stream()
                .map(this::toResponse)
                .toList();

        return PagedResponse.<AdminUserResponse>builder()
                .content(responses)
                .page(userPage.getNumber())
                .size(userPage.getSize())
                .totalElements(userPage.getTotalElements())
                .totalPages(userPage.getTotalPages())
                .first(userPage.isFirst())
                .last(userPage.isLast())
                .build();
    }

    @Transactional
    public AdminUserResponse updateUserStatus(Integer userId, AdminUserStatusRequest request, String currentAdminUsername) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng với ID: " + userId));

        // 1. Chống tự ban chính mình (BL-022)
        if (currentAdminUsername != null && user.getUsername().equalsIgnoreCase(currentAdminUsername.trim())) {
            throw new BadRequestException("Bạn không thể tự thay đổi trạng thái tài khoản của chính mình");
        }

        AccountStatus newStatus;
        try {
            newStatus = AccountStatus.fromString(request.getStatus());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Trạng thái tài khoản không hợp lệ: " + request.getStatus());
        }

        AccountStatus oldStatus = user.getStatus();

        // 2. Chống thay đổi trạng thái PENDING_VERIFY lên thẳng ACTIVE nếu chưa xác thực OTP
        if (oldStatus == AccountStatus.PENDING_VERIFY && newStatus == AccountStatus.ACTIVE) {
            throw new BadRequestException("Không thể kích hoạt tài khoản chưa qua xác thực email OTP");
        }

        // 3. Bảo vệ Last Admin (BL-022)
        if (isUserAdmin(user) && (newStatus == AccountStatus.BANNED || newStatus == AccountStatus.SUSPENDED)) {
            long activeAdminCount = userRepository.countByRoleRoleNameAndStatus("ADMIN", AccountStatus.ACTIVE);
            if (activeAdminCount <= 1) {
                throw new BadRequestException("Không thể khóa tài khoản Quản trị viên duy nhất còn lại trong hệ thống");
            }
        }

        // 4. Áp dụng State Transition & Audit log (BL-015, BL-031)
        user.setStatus(newStatus);
        User saved = userRepository.save(user);

        log.info("AUDIT: Admin [{}] đã thay đổi trạng thái user [{}] (ID: {}) từ [{}] -> [{}]. Lý do: {}",
                currentAdminUsername, user.getUsername(), user.getUserId(), oldStatus, newStatus, request.getReason());

        return toResponse(saved);
    }

    private boolean isUserAdmin(User user) {
        return user.getRole() != null && "ADMIN".equalsIgnoreCase(user.getRole().getRoleName());
    }

    private AdminUserResponse toResponse(User user) {
        return AdminUserResponse.builder()
                .userId(user.getUserId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .roleName(user.getRole() != null ? user.getRole().getRoleName() : null)
                .status(user.getStatus() != null ? user.getStatus().name() : null)
                .strikeCount(user.getStrikeCount())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
```

- [ ] **Step 2: Commit Service**
```bash
git add backend/src/main/java/com/fpt/swp391/nutribot/service/AdminUserService.java
git commit -m "feat(NB-36-BE): hoàn thành Service quản lý tài khoản và state machine

- Thay thế bộ lọc RAM bằng Spring Data Specification lọc trực tiếp trên DB
- Bổ sung chốt chặn bảo vệ Quản trị viên chống tự ban và bảo vệ last admin
- Kiểm soát chuyển đổi trạng thái PENDING_VERIFY và ghi nhận audit log"
```

---

### Task 5: Cập nhật Controller và Enforce Admin Authorization (BL-003)

**Files:**
- Modify: `backend/src/main/java/com/fpt/swp391/nutribot/controller/AdminUserController.java`

**Interfaces:**
- Endpoints:
  - `GET /api/v1/admin/users`: Query params `keyword`, `status`, `page`, `size`.
  - `PUT /api/v1/admin/users/{userId}/status`: Request body `AdminUserStatusRequest`.
- Security: Trích xuất `currentAdminUsername` từ `Authentication.getName()` và truyền vào Service.

- [ ] **Step 1: Cập nhật `AdminUserController.java`**
```java
package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.AdminUserStatusRequest;
import com.fpt.swp391.nutribot.dto.response.AdminUserResponse;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.service.AdminUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<AdminUserResponse>>> getAllUsers(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PagedResponse<AdminUserResponse> result = adminUserService.getAllUsers(keyword, status, page, size);
        return ResponseEntity.ok(ApiResponse.success("Lấy danh sách người dùng thành công", result));
    }

    @PutMapping("/{userId}/status")
    public ResponseEntity<ApiResponse<AdminUserResponse>> updateUserStatus(
            @PathVariable Integer userId,
            @Valid @RequestBody AdminUserStatusRequest request,
            Authentication authentication) {
        String currentAdminUsername = authentication != null ? authentication.getName() : null;
        AdminUserResponse result = adminUserService.updateUserStatus(userId, request, currentAdminUsername);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật trạng thái người dùng thành công", result));
    }
}
```

- [ ] **Step 2: Commit Controller**
```bash
git add backend/src/main/java/com/fpt/swp391/nutribot/controller/AdminUserController.java
git commit -m "feat(NB-36-BE): cập nhật Controller quản lý người dùng với phân quyền Admin

- Gắn @PreAuthorize(\"hasRole('ADMIN')\") cấp controller
- Trích xuất Authentication principal truyền vào Service để kiểm soát self-ban
- Trả về ApiResponse chuẩn hóa toàn hệ thống"
```

---

### Task 6: Viết Bộ Kiểm thử Toàn diện (Unit & Integration Tests)

**Files:**
- Create: `backend/src/test/java/com/fpt/swp391/nutribot/service/AdminUserServiceTest.java`
- Create: `backend/src/test/java/com/fpt/swp391/nutribot/controller/AdminUserControllerTest.java`

**Test Cases Phủ Kín:**
1. `getAllUsers_withKeywordAndStatus_callsSpecificationAndReturnsBoundedPage`: Kiểm tra phân trang và lọc DB.
2. `updateUserStatus_success_transitionsStatusAndAudits`: Chuyển đổi trạng thái thành công (`ACTIVE` ➔ `SUSPENDED`).
3. `updateUserStatus_selfBan_throwsBadRequestException` (BL-022): Admin tự ban chính mình ➔ 400.
4. `updateUserStatus_lastAdmin_throwsBadRequestException` (BL-022): Khóa vị Admin duy nhất ➔ 400.
5. `updateUserStatus_pendingVerifyToActive_throwsBadRequestException` (BL-015): Bypass OTP ➔ 400.
6. `updateUserStatus_nonAdmin_forbidden` (BL-003): User thường gọi API ➔ 403 Forbidden.

- [ ] **Step 1: Tạo `AdminUserServiceTest.java`**
- [ ] **Step 2: Tạo `AdminUserControllerTest.java`**
- [ ] **Step 3: Chạy toàn bộ test suite Maven**
```bash
mvn test -Dtest=AdminUserServiceTest,AdminUserControllerTest,SecurityAuthorizationAndLogoutTest
```
- [ ] **Step 4: Commit Tests**
```bash
git add backend/src/test/java/com/fpt/swp391/nutribot/service/AdminUserServiceTest.java backend/src/test/java/com/fpt/swp391/nutribot/controller/AdminUserControllerTest.java
git commit -m "test(NB-36-BE): bổ sung unit test toàn diện cho Admin User Management #done

- Viết AdminUserServiceTest kiểm tra State Machine, Self-ban và Last-admin guard
- Viết AdminUserControllerTest kiểm tra phân quyền Admin và validation request
- Đạt 100% độ phủ các tiêu chuẩn kiểm toán BL-003, BL-015, BL-022, BL-031"
```
