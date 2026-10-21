package com.fpt.swp391.nutribot.event;

public record ContentCommentedEvent(
        Integer contentId,
        Integer commenterId,
        Integer commentId,
        Integer parentId
) {
}
