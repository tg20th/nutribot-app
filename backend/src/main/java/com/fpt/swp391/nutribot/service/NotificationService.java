package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.NotificationResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.Notification;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.ForbiddenException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.NotificationRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class NotificationService {

    public static final String TYPE_RECIPE_SUGGESTION_APPROVED = "RECIPE_SUGGESTION_APPROVED";
    public static final String TYPE_RECIPE_SUGGESTION_REJECTED = "RECIPE_SUGGESTION_REJECTED";
    public static final String REFERENCE_TYPE_CONTENT_RECIPE_SUGGESTION = "CONTENT_RECIPE_SUGGESTION";
    public static final String ACTION_APPROVE = "APPROVE";
    public static final String ACTION_REJECT = "REJECT";

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public PagedResponse<NotificationResponse> listMyNotifications(Integer userId, int page, int size) {
        int pageNumber = Math.max(page, 0);
        int pageSize = size <= 0 ? 10 : Math.min(size, 50);
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Notification> notificationPage = notificationRepository.findByRecipient_UserIdOrderByCreatedAtDesc(userId, pageable);
        Page<NotificationResponse> mapped = notificationPage.map(this::toResponse);
        return PagedResponse.of(mapped);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(Integer userId) {
        return notificationRepository.countByRecipient_UserIdAndReadAtIsNull(userId);
    }

    @Transactional
    public void markAsRead(Integer userId, Integer notificationId) {
        Notification notification = notificationRepository.findByNotificationIdAndRecipient_UserId(notificationId, userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thông báo"));
        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
            notificationRepository.save(notification);
        }
    }

    @Transactional
    public void markAllAsRead(Integer userId) {
        notificationRepository.markAllAsRead(userId, LocalDateTime.now());
    }

    @Transactional
    public void createForRecipeSuggestionReviewed(Integer authorId, Integer adminId, Integer suggestionId, String action) {
        if (authorId == null || suggestionId == null) {
            return;
        }
        User recipient = userRepository.findById(authorId).orElse(null);
        if (recipient == null) {
            return;
        }
        User actor = null;
        if (adminId != null) {
            actor = userRepository.findById(adminId).orElse(null);
        }
        String type = ACTION_REJECT.equalsIgnoreCase(action) ? TYPE_RECIPE_SUGGESTION_REJECTED : TYPE_RECIPE_SUGGESTION_APPROVED;

        Notification notification = Notification.builder()
                .recipient(recipient)
                .actor(actor)
                .type(type)
                .referenceType(REFERENCE_TYPE_CONTENT_RECIPE_SUGGESTION)
                .referenceId(suggestionId)
                .build();
        notificationRepository.save(notification);
    }

    private NotificationResponse toResponse(Notification notification) {
        User actor = notification.getActor();
        return NotificationResponse.builder()
                .notificationId(notification.getNotificationId())
                .type(notification.getType())
                .referenceType(notification.getReferenceType())
                .referenceId(notification.getReferenceId())
                .actorId(actor != null ? actor.getUserId() : null)
                .actorFullName(actor != null ? actor.getFullName() : null)
                .actorAvatarUrl(actor != null ? actor.getAvatarUrl() : null)
                .read(notification.getReadAt() != null)
                .readAt(notification.getReadAt())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}
