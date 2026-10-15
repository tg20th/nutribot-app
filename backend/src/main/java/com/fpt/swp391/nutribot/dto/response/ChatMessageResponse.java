package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatMessageResponse {
    private Integer messageId;
    private String senderType;
    private String content;
    private LocalDateTime createdAt;
    private List<ChatAttachmentResponse> attachments;
}
