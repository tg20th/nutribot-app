package com.fpt.swp391.nutribot.event;

public record RecipeSuggestionReviewedEvent(
        Integer suggestionId,
        Integer contentId,
        Integer authorId,
        Integer adminId,
        String action
) {
}
