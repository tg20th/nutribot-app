package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.event.RecipeSuggestionReviewedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class NotificationEventListener {

    private final NotificationService notificationService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onRecipeSuggestionReviewed(RecipeSuggestionReviewedEvent event) {
        if (event == null) {
            return;
        }
        notificationService.createForRecipeSuggestionReviewed(
                event.authorId(),
                event.adminId(),
                event.suggestionId(),
                event.action(),
                event.contentId(),
                event.dishName(),
                event.contentTitle(),
                event.rejectionReason());
    }
}
