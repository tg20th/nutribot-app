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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotificationService {

    public static final String TYPE_RECIPE_SUGGESTION_APPROVED = "RECIPE_SUGGESTION_APPROVED";
    public static final String TYPE_RECIPE_SUGGESTION_REJECTED = "RECIPE_SUGGESTION_REJECTED";
    public static final String TYPE_CONTENT_VOTED = "CONTENT_VOTED";
    public static final String TYPE_CONTENT_COMMENTED = "CONTENT_COMMENTED";
    public static final String TYPE_CONTENT_MODERATION_REJECTED = "CONTENT_MODERATION_REJECTED";
    public static final String REFERENCE_TYPE_CONTENT_RECIPE_SUGGESTION = "CONTENT_RECIPE_SUGGESTION";
    public static final String REFERENCE_TYPE_CONTENT = "CONTENT";
    public static final String ACTION_APPROVE = "APPROVE";
    public static final String ACTION_REJECT = "REJECT";

    /** NB-84: Tieu de gan cho thong bao ket qua duyet cong thuc. */
    public static final String TITLE_SUGGESTION_APPROVED = "Công thức đã được thêm vào NutriBot";
    public static final String TITLE_SUGGESTION_REJECTED = "Đề xuất công thức chưa được duyệt";
    public static final String TITLE_SUGGESTION_CLOSED = "Đề xuất công thức đã được đóng";

    /** NB-84: Do dai toi da cho noi dung thong bao (khop cot NVARCHAR(1000)). */
    private static final int MAX_MESSAGE_LENGTH = 1000;

    /** NB-83: Cửa sổ gom nhóm vote (phút). Vote mới trong cửa sổ này sẽ gộp vào notification hiện có. */
    public static final int VOTE_GROUP_WINDOW_MINUTES = 30;

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final ContentRepository contentRepository;

    @Transactional(readOnly = true)
    public PagedResponse<NotificationResponse> listMyNotifications(Integer userId, int page, int size) {
        int pageNumber = Math.max(page, 0);
        int pageSize = size <= 0 ? 10 : Math.min(size, 50);
        Pageable pageable = PageRequest.of(pageNumber, pageSize);
        Page<Notification> notificationPage = notificationRepository.findByRecipientIdOrderByActivityDesc(userId, pageable);
        Map<Integer, Content> contentMap = loadReferencedContents(notificationPage.getContent());
        Page<NotificationResponse> mapped = notificationPage.map(notification -> toResponse(notification, contentMap));
        return PagedResponse.of(mapped);
    }

    /**
     * NB-83: Tai thong tin bai viet (tieu de, loai noi dung) cho cac thong bao trong trang hien tai.
     * Gom 1 lan truy van cho ca trang (batch) de khong sinh N+1 query.
     * Thong bao khong tro toi bai viet (vi du duyet cong thuc cua NB-81) se khong co du lieu nay.
     */
    private Map<Integer, Content> loadReferencedContents(List<Notification> notifications) {
        Set<Integer> contentIds = notifications.stream()
                .filter(notification -> REFERENCE_TYPE_CONTENT.equals(notification.getReferenceType()))
                .map(Notification::getReferenceId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (contentIds.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Content> contentMap = new HashMap<>();
        for (Content content : contentRepository.findAllById(contentIds)) {
            contentMap.put(content.getContentId(), content);
        }
        return contentMap;
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
        createForRecipeSuggestionReviewed(authorId, adminId, suggestionId, action, null, null, null, null);
    }

    /**
     * NB-84: Thông báo kết quả duyệt đề xuất công thức có nội dung cụ thể.
     * Tác giả thấy rõ công thức nào đã vào hệ thống hoặc bị từ chối vì lý do gì,
     * thay vì chỉ nhận một thông báo trống không nội dung.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createForRecipeSuggestionReviewed(
            Integer authorId,
            Integer adminId,
            Integer suggestionId,
            String action,
            Integer contentId,
            String dishName,
            String contentTitle,
            String rejectionReason) {
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
        boolean rejected = ACTION_REJECT.equalsIgnoreCase(action);
        String type = rejected ? TYPE_RECIPE_SUGGESTION_REJECTED : TYPE_RECIPE_SUGGESTION_APPROVED;

        Notification notification = Notification.builder()
                .recipient(recipient)
                .actor(actor)
                .type(type)
                .referenceType(REFERENCE_TYPE_CONTENT_RECIPE_SUGGESTION)
                .referenceId(suggestionId)
                .title(rejected ? TITLE_SUGGESTION_REJECTED : TITLE_SUGGESTION_APPROVED)
                .message(rejected
                        ? buildRejectedMessage(dishName, contentTitle, rejectionReason)
                        : buildApprovedMessage(dishName, contentTitle))
                .actionUrl(buildActionUrl(contentId))
                .build();
        notificationRepository.save(notification);
    }

    /**
     * NB-84: Thông báo cho tác giả khi đề xuất công thức bị đóng tự động vì bài viết
     * không còn đồng thuận dùng công thức (tác giả gỡ đồng thuận hoặc job quét đối soát).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createForRecipeSuggestionClosed(
            Integer authorId,
            Integer suggestionId,
            Integer contentId,
            String dishName,
            String contentTitle,
            String reason) {
        if (authorId == null || suggestionId == null) {
            return;
        }
        User recipient = userRepository.findById(authorId).orElse(null);
        if (recipient == null) {
            return;
        }

        Notification notification = Notification.builder()
                .recipient(recipient)
                .actor(null)
                .type(TYPE_RECIPE_SUGGESTION_REJECTED)
                .referenceType(REFERENCE_TYPE_CONTENT_RECIPE_SUGGESTION)
                .referenceId(suggestionId)
                .title(TITLE_SUGGESTION_CLOSED)
                .message(buildClosedMessage(dishName, contentTitle, reason))
                .actionUrl(buildActionUrl(contentId))
                .build();
        notificationRepository.save(notification);
    }

    /**
     * Thông báo cho tác giả khi bài viết bị Admin từ chối do vi phạm quy chuẩn nội dung,
     * kèm số gậy (strike) hiện tại và cảnh báo nếu bị khóa tài khoản.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createForContentModerationRejected(
            Integer authorId,
            Integer contentId,
            String contentTitle,
            int strikeCount,
            String reason) {
        if (authorId == null) {
            return;
        }
        User recipient = userRepository.findById(authorId).orElse(null);
        if (recipient == null) {
            return;
        }

        String title = strikeCount >= 3
                ? "Tài khoản của bạn đã bị khóa do vi phạm nhiều lần"
                : "Bài viết của bạn đã bị từ chối do vi phạm quy chuẩn";

        StringBuilder sb = new StringBuilder();
        if (hasText(contentTitle)) {
            sb.append("Bài viết \"").append(contentTitle.trim()).append("\" của bạn đã bị từ chối.");
        } else {
            sb.append("Bài viết của bạn đã bị từ chối.");
        }
        sb.append(" Lý do: ").append(hasText(reason) ? reason.trim() : "Vi phạm tiêu chuẩn cộng đồng").append(".");
        sb.append(" Cảnh báo vi phạm: ").append(strikeCount).append("/3 gậy.");
        if (strikeCount >= 3) {
            sb.append(" Tài khoản của bạn đã bị tạm khóa do nhận đủ 3 gậy vi phạm.");
        }

        Notification notification = Notification.builder()
                .recipient(recipient)
                .actor(null)
                .type(TYPE_CONTENT_MODERATION_REJECTED)
                .referenceType(REFERENCE_TYPE_CONTENT)
                .referenceId(contentId)
                .title(truncate(title))
                .message(truncate(sb.toString()))
                .actionUrl("/profile")
                .build();
        notificationRepository.save(notification);
    }

    /**
     * NB-84: Nội dung thông báo khi admin duyệt công thức.
     */
    private String buildApprovedMessage(String dishName, String contentTitle) {
        StringBuilder message = new StringBuilder();
        if (hasText(dishName)) {
            message.append("Công thức \"").append(dishName).append("\"");
        }
        if (hasText(contentTitle)) {
            message.append(message.length() > 0 ? " từ bài viết \"" : "Bài viết \"").append(contentTitle).append("\"");
        }
        if (message.length() == 0) {
            message.append("Công thức từ bài viết của bạn");
        }
        message.append(" của bạn đã được duyệt và thêm vào hệ thống. Bạn có thể tìm món này trong danh mục món ăn.");
        return truncate(message.toString());
    }

    /**
     * NB-84: Noi dung thong bao khi admin tu choi cong thuc, kem ly do.
     */
    private String buildRejectedMessage(String dishName, String contentTitle, String rejectionReason) {
        StringBuilder message = new StringBuilder();
        if (hasText(dishName)) {
            message.append("Công thức \"").append(dishName).append("\"");
        }
        if (hasText(contentTitle)) {
            message.append(message.length() > 0 ? " từ bài viết \"" : "Bài viết \"").append(contentTitle).append("\"");
        }
        if (message.length() == 0) {
            message.append("Công thức từ bài viết của bạn");
        }
        message.append(" của bạn chưa được duyệt.");
        if (hasText(rejectionReason)) {
            message.append(" Lý do: ").append(rejectionReason.trim());
        }
        return truncate(message.toString());
    }

    /**
     * NB-84: Nội dung thông báo khi đề xuất công thức bị đóng tự động.
     */
    private String buildClosedMessage(String dishName, String contentTitle, String reason) {
        StringBuilder message = new StringBuilder();
        if (hasText(dishName)) {
            message.append("Công thức \"").append(dishName).append("\"");
        }
        if (hasText(contentTitle)) {
            message.append(message.length() > 0 ? " từ bài viết \"" : "Bài viết \"").append(contentTitle).append("\"");
        }
        if (message.length() == 0) {
            message.append("Đề xuất công thức của bạn");
        }
        message.append(" đã được đóng và không được duyệt.");
        if (hasText(reason)) {
            message.append(" Lý do: ").append(reason.trim());
        }
        return truncate(message.toString());
    }

    private String buildActionUrl(Integer contentId) {
        if (contentId == null) {
            return null;
        }
        return "/community/posts/" + contentId;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() <= MAX_MESSAGE_LENGTH ? value : value.substring(0, MAX_MESSAGE_LENGTH);
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
        return toResponse(notification, Map.of());
    }

    /**
     * NB-83: Chuyen notification sang response kem thong tin bai viet duoc vote/comment.
     * contentTitle/contentType null khi thong bao khong tro toi bai viet
     * (duyet cong thuc cua NB-81) hoac khi bai viet da bi xoa.
     */
    private NotificationResponse toResponse(Notification notification, Map<Integer, Content> contentMap) {
        User actor = notification.getActor();
        Content content = REFERENCE_TYPE_CONTENT.equals(notification.getReferenceType())
                ? contentMap.get(notification.getReferenceId())
                : null;
        LocalDateTime updatedAt = notification.getUpdatedAt() != null
                ? notification.getUpdatedAt()
                : notification.getCreatedAt();
        return NotificationResponse.builder()
                .notificationId(notification.getNotificationId())
                .type(notification.getType())
                .referenceType(notification.getReferenceType())
                .referenceId(notification.getReferenceId())
                .actorId(actor != null ? actor.getUserId() : null)
                .actorFullName(actor != null ? actor.getFullName() : null)
                .actorAvatarUrl(actor != null ? actor.getAvatarUrl() : null)
                .contentTitle(content != null ? content.getTitle() : null)
                .contentType(content != null ? content.getContentType() : null)
                .read(notification.getReadAt() != null)
                .readAt(notification.getReadAt())
                .createdAt(notification.getCreatedAt())
                .updatedAt(updatedAt)
                .title(notification.getTitle())
                .message(notification.getMessage())
                .actionUrl(notification.getActionUrl())
                .build();
    }
}
