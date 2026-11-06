package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.AdminUserStatusRequest;
import com.fpt.swp391.nutribot.dto.response.AdminUserResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.dto.response.ModerationAuditResponse;
import com.fpt.swp391.nutribot.dto.response.UserModerationActionResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.ModerationDecisionAudit;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.event.AccountSuspendedEvent;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.repository.ModerationDecisionAuditRepository;
import com.fpt.swp391.nutribot.repository.UserModerationActionRepository;
import com.fpt.swp391.nutribot.entity.UserModerationAction;
import com.fpt.swp391.nutribot.repository.specification.UserSpecifications;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private static final int MAX_PAGE_SIZE = 50;
    private static final int DEFAULT_PAGE_SIZE = 10;

    private final UserRepository userRepository;
    private final ModerationDecisionAuditRepository moderationDecisionAuditRepository;
    private final UserModerationActionRepository userModerationActionRepository;
    private final ApplicationEventPublisher eventPublisher;

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
        log.info("Manual account status request received: userId={}, requestedStatus={}, adminPresent={}", userId, request == null ? null : request.getStatus(), currentAdminUsername != null && !currentAdminUsername.isBlank());
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

        if (newStatus == AccountStatus.BANNED && oldStatus != AccountStatus.BANNED) {
            String reason = request.getReason() == null ? "" : request.getReason().trim();
            if (reason.length() < 10 || reason.length() > 500) {
                throw new BadRequestException("A manual suspension reason must be between 10 and 500 characters");
            }
        }

        // 2. Chống thay đổi trạng thái PENDING_VERIFY lên thẳng ACTIVE nếu chưa xác thực OTP (BL-015)
        if (oldStatus == AccountStatus.PENDING_VERIFY && newStatus == AccountStatus.ACTIVE) {
            throw new BadRequestException("Không thể kích hoạt tài khoản chưa qua xác thực email OTP");
        }

        // 3. Bảo vệ Last Active Admin (BL-022)
        if (isUserAdmin(user) && newStatus == AccountStatus.BANNED) {
            long activeAdminCount = userRepository.countActiveAdmins(AccountStatus.ACTIVE);
            if (activeAdminCount <= 1) {
                throw new BadRequestException("Không thể khóa tài khoản Quản trị viên duy nhất còn lại trong hệ thống");
            }
        }

        // 4. Nếu mở khóa từ BANNED về ACTIVE, reset strikeCount về 0
        if (oldStatus == AccountStatus.BANNED && newStatus == AccountStatus.ACTIVE) {
            user.setStrikeCount(0);
        }

        // 5. Áp dụng State Transition & Audit log (BL-015, BL-031)
        user.setStatus(newStatus);
        User saved = userRepository.save(user);
        if (oldStatus != newStatus) {
            String action = newStatus == AccountStatus.BANNED ? "BAN" : (oldStatus == AccountStatus.BANNED && newStatus == AccountStatus.ACTIVE ? "UNBAN" : "STATUS_CHANGE");
            String historyReason = request.getReason() == null || request.getReason().isBlank() ? "Account status changed by administrator" : request.getReason().trim();
            Integer adminId = currentAdminUsername == null ? null : userRepository.findByNormalizedUsernameOrEmail(currentAdminUsername).map(User::getUserId).orElse(null);
            userModerationActionRepository.save(UserModerationAction.builder().userId(user.getUserId()).adminId(adminId).action(action).source("MANUAL").previousStatus(oldStatus.name()).newStatus(newStatus.name()).reason(historyReason).additionalExplanation(request.getReason()).strikeDelta((short) 0).build());
        }
        log.info("Account status changed in transaction: userId={}, oldStatus={}, newStatus={}", user.getUserId(), oldStatus, newStatus);
        if (oldStatus != AccountStatus.BANNED && newStatus == AccountStatus.BANNED && eventPublisher != null) {
            eventPublisher.publishEvent(new AccountSuspendedEvent(user.getUserId(), false, request.getReason()));
            log.info("Account suspension event published: userId={}, type=MANUAL", user.getUserId());
        }

        log.info("AUDIT: Admin [{}] đã thay đổi trạng thái user [{}] (ID: {}) từ [{}] -> [{}]. Lý do: {}",
                currentAdminUsername, user.getUsername(), user.getUserId(), oldStatus, newStatus, request.getReason());

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PagedResponse<ModerationAuditResponse> getViolationHistory(Integer userId, int page, int size) {
        if (!userRepository.existsById(userId)) throw new NotFoundException("Không tìm thấy người dùng với ID: " + userId);
        int boundedPage = Math.max(page, 0);
        int boundedSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        Page<ModerationDecisionAudit> audits = moderationDecisionAuditRepository
                .findByAuthorIdAndActionOrderByDecidedAtDescAuditIdDesc(userId, "REJECT", PageRequest.of(boundedPage, boundedSize));
        return PagedResponse.<ModerationAuditResponse>builder()
                .content(audits.getContent().stream().map(audit -> ModerationAuditResponse.builder()
                        .auditId(audit.getAuditId()).contentId(audit.getContentId()).contentType(audit.getContentType())
                        .contentTitle(audit.getContentTitle()).authorUsername(audit.getAuthorUsername())
                        .action(audit.getAction()).previousStatus(audit.getPreviousStatus()).newStatus(audit.getNewStatus())
                        .adminId(audit.getAdminId()).adminUsername(audit.getAdminUsername()).adminReason(audit.getAdminReason())
                        .decidedAt(audit.getDecidedAt()).aiFlagged(audit.getAiFlagged()).aiReason(audit.getAiReason())
                        .aiConfidence(audit.getAiConfidence() == null ? null : audit.getAiConfidence().doubleValue())
                        .contentBodySnapshot(audit.getContentBodySnapshot()).thumbnailUrlSnapshot(audit.getThumbnailUrlSnapshot())
                        .mediaUrlSnapshot(audit.getMediaUrlSnapshot()).build()).toList())
                .page(audits.getNumber()).size(audits.getSize()).totalElements(audits.getTotalElements())
                .totalPages(audits.getTotalPages()).first(audits.isFirst()).last(audits.isLast()).build();
    }

    @Transactional(readOnly = true)
    public PagedResponse<UserModerationActionResponse> getStatusHistory(Integer userId, String action, int page, int size) {
        if (!userRepository.existsById(userId)) throw new NotFoundException("User not found: " + userId);
        int boundedSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        Page<UserModerationAction> actions = action == null || action.isBlank() ? userModerationActionRepository.findByUserIdOrderByCreatedAtDescActionIdDesc(userId, PageRequest.of(Math.max(page, 0), boundedSize)) : userModerationActionRepository.findByUserIdAndActionOrderByCreatedAtDescActionIdDesc(userId, action, PageRequest.of(Math.max(page, 0), boundedSize));
        return PagedResponse.<UserModerationActionResponse>builder()
                .content(actions.getContent().stream().map(a -> UserModerationActionResponse.builder().actionId(a.getActionId()).userId(a.getUserId()).adminId(a.getAdminId()).action(a.getAction()).source(a.getSource()).reason(a.getReason()).additionalExplanation(a.getAdditionalExplanation()).previousStatus(a.getPreviousStatus()).newStatus(a.getNewStatus()).strikeDelta(a.getStrikeDelta()).createdAt(a.getCreatedAt()).build()).toList())
                .page(actions.getNumber()).size(actions.getSize()).totalElements(actions.getTotalElements()).totalPages(actions.getTotalPages()).first(actions.isFirst()).last(actions.isLast()).build();
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
