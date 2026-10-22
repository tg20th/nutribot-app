package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.event.RecipeSuggestionReviewedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationEventListener {

    private final NotificationService notificationService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onRecipeSuggestionReviewed(RecipeSuggestionReviewedEvent event) {
        if (event == null) {
            return;
        }
        try {
            notificationService.createForRecipeSuggestionReviewed(
                    event.authorId(),
                    event.adminId(),
                    event.suggestionId(),
                    event.action(),
                    event.contentId(),
                    event.dishName(),
                    event.contentTitle(),
                    event.rejectionReason());
        } catch (RuntimeException ex) {
            // NB-87: Duyệt đã commit rồi, lỗi gửi thông báo không được làm hỏng request của Admin
            log.error("Không gửi được thông báo duyệt đề xuất công thức {}", event.suggestionId(), ex);
        }
    }
}
