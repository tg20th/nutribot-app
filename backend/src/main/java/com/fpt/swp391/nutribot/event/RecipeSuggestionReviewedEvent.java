package com.fpt.swp391.nutribot.event;

/**
 * NB-84: Su kien admin da xu ly xong de xuat cong thuc.
 * Ban su kien ghi them ten cong thuc, tieu de bai viet va ly do tu choi de
 * thong bao gui cho tac gia co noi dung cu the, khong chi loai su kien.
 */
public record RecipeSuggestionReviewedEvent(
        Integer suggestionId,
        Integer contentId,
        Integer authorId,
        Integer adminId,
        String action,
        String dishName,
        String contentTitle,
        String rejectionReason
) {

    public RecipeSuggestionReviewedEvent(
            Integer suggestionId,
            Integer contentId,
            Integer authorId,
            Integer adminId,
            String action) {
        this(suggestionId, contentId, authorId, adminId, action, null, null, null);
    }
}
