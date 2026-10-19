package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.event.ContentModerationRequestedEvent;
import com.fpt.swp391.nutribot.event.ContentPublishedEvent;
import com.fpt.swp391.nutribot.repository.CategoryRepository;
import com.fpt.swp391.nutribot.repository.ContentModerationRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Lắng nghe {@link ContentModerationRequestedEvent} (phát ra ngay khi tác giả nộp bài)
 * và xử lý AI moderation ở thread pool, không chặn request HTTP.
 *
 * <p>Quy tắc nghiệp vụ giữ nguyên như cũ (NB-65):
 * <ul>
 *   <li>AI APPROVE → {@code published}</li>
 *   <li>AI REJECT / NEEDS_REVIEW / timeout / lỗi → giữ {@code under_review} (chờ Admin duyệt)</li>
 * </ul>
 * </p>
 *
 * <p>Nếu AI service throw exception, listener vẫn phải đảm bảo bài được chuyển về
 * {@code under_review} (không bị stuck ở {@code ai_processing}).</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ContentModerationListener {

    private final ContentRepository contentRepository;
    private final ContentModerationGatewayService contentModerationGatewayService;
    private final ContentModerationRepository contentModerationRepository;
    private final CategoryRepository categoryRepository;
    private final ApplicationEventPublisher applicationEventPublisher;

    /**
     * Chạy bất đồng bộ SAU KHI transaction commit thành công (không rollback listener nếu fail).
     * {@code fallbackExecution = true} để chạy ngay cả khi không có transaction (test).
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void handleModerationRequested(ContentModerationRequestedEvent event) {
        if (event == null || event.contentId() == null) {
            log.warn("Received ContentModerationRequestedEvent with null contentId, skipping");
            return;
        }

        Integer contentId = event.contentId();
        log.info("Bắt đầu xử lý AI moderation bất đồng bộ cho content {} (type={}, author={})",
                contentId, event.contentType(), event.authorId());

        Optional<Content> contentOpt = contentRepository.findById(contentId);
        if (contentOpt.isEmpty()) {
            log.warn("Content {} không tồn tại, bỏ qua AI moderation", contentId);
            return;
        }

        Content content = contentOpt.get();
        ContentModerationGatewayService.ModerationResult moderation;
        try {
            moderation = contentModerationGatewayService.moderateContent(
                    content.getContentId(),
                    content.getContentType(),
                    content.getTitle(),
                    extractDescription(content.getBody()),
                    content.getBody(),
                    getCategoryName(content.getCategoryId()),
                    java.util.List.of(),
                    content.getThumbnailUrl(),
                    content.getMediaUrl()
            );
        } catch (Exception ex) {
            // AI service hoàn toàn down — chuyển bài về under_review để Admin xử lý
            log.error("AI moderation cho content {} ném exception: {}. Chuyển bài về under_review.",
                    contentId, ex.getMessage(), ex);
            content.setStatus(AuthorContentService.STATUS_UNDER_REVIEW);
            contentRepository.save(content);
            return;
        }

        log.info("AI moderation result for content {}: decision={}, reason={}, confidence={}",
                contentId, moderation.decision(), moderation.reason(), moderation.confidence());

        // QUY TẮC: chỉ APPROVE -> published; các decision khác -> giữ under_review
        boolean isApproved = "APPROVE".equalsIgnoreCase(moderation.decision());
        if (isApproved) {
            content.setStatus(AuthorContentService.STATUS_PUBLISHED);
            log.info("Content {} auto-approved by AI", contentId);
            // NB-80: Phát ContentPublishedEvent như AdminModerationService để
            // ContentRecipeSuggestionListener đánh giá tạo suggestion ngay lập tức
            // (không phải chờ sweep job 10 phút).
            applicationEventPublisher.publishEvent(new ContentPublishedEvent(contentId));
        } else {
            content.setStatus(AuthorContentService.STATUS_UNDER_REVIEW);
            log.info("Content {} chuyển sang hàng đợi Admin duyệt (AI decision: {}, reason: {})",
                    contentId, moderation.decision(), moderation.reason());
        }

        contentRepository.save(content);
        saveOrUpdateModeration(contentId, moderation, isApproved);
    }

    private void saveOrUpdateModeration(Integer contentId,
                                        ContentModerationGatewayService.ModerationResult moderation,
                                        boolean isApproved) {
        try {
            com.fpt.swp391.nutribot.entity.ContentModeration cm = contentModerationRepository.findByContentId(contentId)
                    .orElseGet(() -> com.fpt.swp391.nutribot.entity.ContentModeration.builder()
                            .contentId(contentId)
                            .createdAt(LocalDateTime.now())
                            .build());

            cm.setAiFlagged(!isApproved);
            cm.setAiReason(moderation.reason());
            if (moderation.confidence() != null) {
                double conf = Math.max(0.0, Math.min(1.0, moderation.confidence()));
                cm.setAiConfidence(BigDecimal.valueOf(conf).setScale(4, RoundingMode.HALF_UP));
            }
            cm.setStatus(isApproved ? "approved" : "pending");
            contentModerationRepository.save(cm);
            log.info("Lưu thành công kết quả kiểm duyệt AI vào content_moderations cho content {}: status={}, aiFlagged={}",
                    contentId, cm.getStatus(), cm.getAiFlagged());
        } catch (Exception e) {
            log.error("Không thể lưu kết quả kiểm duyệt AI cho content {}: {}", contentId, e.getMessage(), e);
        }
    }

    private String extractDescription(String body) {
        if (body == null || body.isBlank()) {
            return "";
        }
        String text = body.replaceAll("<[^>]*>", "").trim();
        if (text.length() <= 200) {
            return text;
        }
        return text.substring(0, 200) + "...";
    }

    private String getCategoryName(Integer categoryId) {
        if (categoryId == null) {
            return "";
        }
        return categoryRepository.findById(categoryId)
                .map(c -> c.getCategoryName())
                .orElse("");
    }
}
