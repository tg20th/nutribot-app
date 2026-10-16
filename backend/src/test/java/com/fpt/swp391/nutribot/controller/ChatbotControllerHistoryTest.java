package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ChatAttachmentResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ChatbotControllerHistoryTest {

    @Test
    void mediaOnlyHistoryGetsCanonicalNonEmptyContent() {
        String normalized = ChatbotController.canonicalHistoryContent(
                "", List.of(ChatAttachmentResponse.builder().type("VIDEO").build()));

        assertEquals("User attached a video for analysis.", normalized);
    }
}
