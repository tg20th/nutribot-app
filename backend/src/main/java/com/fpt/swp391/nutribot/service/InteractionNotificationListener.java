package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.event.ContentCommentedEvent;
import com.fpt.swp391.nutribot.event.ContentVotedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * NB-83: Nghe sự kiện vote/comment sau khi transaction gốc đã commit
 * để không phát sinh notification khi thao tác bị rollback.
 */
@Component
@RequiredArgsConstructor
public class InteractionNotificationListener {

    private final NotificationService notificationService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onContentVoted(ContentVotedEvent event) {
        if (event == null || event.contentId() == null || event.voterId() == null) {
            return;
        }
        notificationService.notifyContentVoted(event.contentId(), event.voterId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onContentCommented(ContentCommentedEvent event) {
        if (event == null || event.contentId() == null || event.commenterId() == null) {
            return;
        }
        notificationService.notifyContentCommented(event.contentId(), event.commenterId());
    }
}
