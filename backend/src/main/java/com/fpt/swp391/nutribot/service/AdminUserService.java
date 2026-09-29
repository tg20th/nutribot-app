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
    public AdminUserResponse updateUserStatus(Integer userId, AdminUserStatusRequest request) {
        return updateUserStatus(userId, request, null);
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

        // 2. Chống thay đổi trạng thái PENDING_VERIFY lên thẳng ACTIVE nếu chưa xác thực OTP (BL-015)
        if (oldStatus == AccountStatus.PENDING_VERIFY && newStatus == AccountStatus.ACTIVE) {
            throw new BadRequestException("Không thể kích hoạt tài khoản chưa qua xác thực email OTP");
        }

        // 3. Bảo vệ Last Active Admin (BL-022)
        if (isUserAdmin(user) && (newStatus == AccountStatus.BANNED || newStatus == AccountStatus.SUSPENDED)) {
            long activeAdminCount = userRepository.countActiveAdmins(AccountStatus.ACTIVE);
            if (activeAdminCount <= 1) {
                throw new BadRequestException("Không thể khóa tài khoản Quản trị viên duy nhất còn lại trong hệ thống");
            }
        }

        // 4. Nếu mở khóa từ SUSPENDED hoặc BANNED về ACTIVE, reset strikeCount về 0
        if ((oldStatus == AccountStatus.SUSPENDED || oldStatus == AccountStatus.BANNED) && newStatus == AccountStatus.ACTIVE) {
            user.setStrikeCount(0);
        }

        // 5. Áp dụng State Transition & Audit log (BL-015, BL-031)
        user.setStatus(newStatus);
        User saved = userRepository.save(user);

        log.info("AUDIT: Admin [{}] đã thay đổi trạng thái user [{}] (ID: {}) từ [{}] -> [{}]. Lý do: {}",
                currentAdminUsername, user.getUsername(), user.getUserId(), oldStatus, newStatus, request.getReason());

        return toResponse(saved);
    }

    private boolean isUserAdmin(User user) {
        if (user.getRole() == null || user.getRole().getRoleName() == null) {
            return false;
        }
        String r = user.getRole().getRoleName().trim().toUpperCase();
        return r.equals("ADMIN") || r.equals("ROLE_ADMIN");
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
