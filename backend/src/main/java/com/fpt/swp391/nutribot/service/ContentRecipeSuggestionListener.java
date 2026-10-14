package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.event.ContentPublishedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * NB-60: Lắng nghe sự kiện nội dung được publish sau khi transaction duyệt commit,
 * rồi chuyển sang xử lý bất đồng bộ (không chặn response của Admin).
 */
@Component
@RequiredArgsConstructor
public class ContentRecipeSuggestionListener {

    private final ContentRecipeSuggestionService contentRecipeSuggestionService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onContentPublished(ContentPublishedEvent event) {
        if (event == null || event.contentId() == null) {
            return;
        }
        contentRecipeSuggestionService.evaluateContentById(event.contentId());
    }
}
