package com.fpt.swp391.nutribot.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminContentResponse {

    private Integer contentId;
    private String contentType;
    private String title;
    private String slug;
    private String status;
    private String authorUsername;
    private String authorEmail;
    private Integer viewCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
