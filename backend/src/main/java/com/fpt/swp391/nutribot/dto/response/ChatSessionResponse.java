package com.fpt.swp391.nutribot.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ChatSessionResponse {
    private Integer sessionId; private String title; private String preview; private long messageCount; private LocalDateTime updatedAt;
}
