package com.fpt.swp391.nutribot.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ModerationAuditResponse {
    private Long auditId; private Integer contentId; private String contentType; private String contentTitle; private String authorUsername;
    private String action; private String previousStatus; private String newStatus; private Integer adminId; private String adminUsername;
    private String adminReason; private LocalDateTime decidedAt; private Boolean aiFlagged; private String aiReason; private Double aiConfidence;
    private String contentBodySnapshot; private String thumbnailUrlSnapshot; private String mediaUrlSnapshot;
}
