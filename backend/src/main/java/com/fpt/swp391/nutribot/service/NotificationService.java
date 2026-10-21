package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.NotificationResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.Notification;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.NotificationRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class NotificationService {

    public static final String TYPE_RECIPE_SUGGESTION_APPROVED = "RECIPE_SUGGESTION_APPROVED";
    public static final String TYPE_RECIPE_SUGGESTION_REJECTED = "RECIPE_SUGGESTION_REJECTED";
    public static final String TYPE_CONTENT_VOTED = "CONTENT_VOTED";
    public static final String TYPE_CONTENT_COMMENTED = "CONTENT_COMMENTED";
    public static final String REFERENCE_TYPE_CONTENT_RECIPE_SUGGESTION = "CONTENT_RECIPE_SUGGESTION";
    public static final String REFERENCE_TYPE_CONTENT = "CONTENT";
    public static final String ACTION_APPROVE = "APPROVE";
    public static final String ACTION_REJECT = "REJECT";

    /** NB-83: Cửa sổ gom nhóm vote (phút). Vote mới trong cửa sổ này sẽ gộp vào notification hiện có. */
    public static final int VOTE_GROUP_WINDOW_MINUTES = 30;

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final ContentRepository contentRepository;

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

    /**
     * NB-81: Thông báo kết quả duyệt đề xuất công thức cho tác giả.
     * REQUIRES_NEW: listener chạy ở phase AFTER_COMMIT nên phải mở transaction mới,
     * nếu không thao tác ghi sẽ bị gộp vào transaction đã commit và không được lưu.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
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

    /**
     * NB-83: Tác giả bài viết được thông báo khi có người khác vote bài của mình.
     * Các vote gần nhau (trong {@link #VOTE_GROUP_WINDOW_MINUTES}) được gộp vào cùng 1 notification
     * để tránh spam. Notification đã đọc sẽ được đánh dấu chưa đọc lại để tác giả không bỏ lỡ.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyContentVoted(Integer contentId, Integer voterId) {
        if (contentId == null || voterId == null) {
            return;
        }
        Integer authorId = resolveContentAuthorId(contentId);
        if (authorId == null || authorId.equals(voterId)) {
            return;
        }
        User recipient = userRepository.findById(authorId).orElse(null);
        if (recipient == null) {
            return;
        }
        User actor = userRepository.findById(voterId).orElse(null);
        LocalDateTime now = LocalDateTime.now();

        Optional<Notification> existing = notificationRepository.findLatestForGrouping(
                authorId, TYPE_CONTENT_VOTED, REFERENCE_TYPE_CONTENT, contentId, PageRequest.of(0, 1)).stream().findFirst();
        if (existing.isPresent()) {
            Notification notification = existing.get();
            LocalDateTime lastActivity = notification.getUpdatedAt() != null
                    ? notification.getUpdatedAt()
                    : notification.getCreatedAt();
            if (lastActivity != null && ChronoUnit.MINUTES.between(lastActivity, now) < VOTE_GROUP_WINDOW_MINUTES) {
                notification.setActor(actor);
                notification.setUpdatedAt(now);
                notification.setReadAt(null);
                notificationRepository.save(notification);
                return;
            }
        }

        Notification notification = Notification.builder()
                .recipient(recipient)
                .actor(actor)
                .type(TYPE_CONTENT_VOTED)
                .referenceType(REFERENCE_TYPE_CONTENT)
                .referenceId(contentId)
                .createdAt(now)
                .updatedAt(now)
                .build();
        notificationRepository.save(notification);
    }

    /**
     * NB-83: Tác giả bài viết được thông báo khi có người khác comment bài của mình.
     * Mỗi comment là 1 notification riêng để không bỏ sót nội dung cụ thể.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyContentCommented(Integer contentId, Integer commenterId) {
        if (contentId == null || commenterId == null) {
            return;
        }
        Integer authorId = resolveContentAuthorId(contentId);
        if (authorId == null || authorId.equals(commenterId)) {
            return;
        }
        User recipient = userRepository.findById(authorId).orElse(null);
        if (recipient == null) {
            return;
        }
        User actor = userRepository.findById(commenterId).orElse(null);
        LocalDateTime now = LocalDateTime.now();

        Notification notification = Notification.builder()
                .recipient(recipient)
                .actor(actor)
                .type(TYPE_CONTENT_COMMENTED)
                .referenceType(REFERENCE_TYPE_CONTENT)
                .referenceId(contentId)
                .createdAt(now)
                .updatedAt(now)
                .build();
        notificationRepository.save(notification);
    }

    /**
     * NB-83: Lấy tác giả của content kèm khoá dòng (PESSIMISTIC_WRITE) để serialize việc
     * tạo/gộp notification cho cùng 1 bài viết, tránh race tạo trùng notification.
     */
    private Integer resolveContentAuthorId(Integer contentId) {
        Content content = contentRepository.findByIdForUpdate(contentId).orElse(null);
        if (content == null || content.getUser() == null) {
            return null;
        }
        return content.getUser().getUserId();
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
