package com.fpt.swp391.nutribot.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ChatMessageResponse {
    private Integer messageId; private String senderType; private String content; private LocalDateTime createdAt;
}
