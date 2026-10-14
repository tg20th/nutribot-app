package com.fpt.swp391.nutribot.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * NB-60: Job định kỳ rà soát nội dung đã publish đủ ngưỡng view/vote nhưng chưa có
 * suggestion (ví dụ nội dung cũ bỗng trở nên phổ biến sau khi được duyệt).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ContentRecipeSuggestionSweepJob {

    private final ContentRecipeSuggestionService contentRecipeSuggestionService;

    @Scheduled(
            fixedDelayString = "${app.content-recipe-suggestion.sweep-interval-ms:600000}",
            initialDelayString = "${app.content-recipe-suggestion.sweep-initial-delay-ms:60000}")
    public void sweepEligibleContents() {
        try {
            int created = contentRecipeSuggestionService.evaluateEligibleContents();
            if (created > 0) {
                log.info("Sweep recipe suggestion đã tạo {} suggestion mới", created);
            }
        } catch (Exception ex) {
            log.error("Sweep recipe suggestion thất bại: {}", ex.getMessage());
        }
    }
}
