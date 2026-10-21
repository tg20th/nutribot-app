package com.fpt.swp391.nutribot.event;

public record ContentVotedEvent(
        Integer contentId,
        Integer voterId
) {
}
