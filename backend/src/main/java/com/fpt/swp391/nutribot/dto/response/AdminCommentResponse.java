package com.fpt.swp391.nutribot.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminCommentResponse {

    private Integer commentId;
    private Integer contentId;
    private String contentTitle;
    private String contentType;
    private Integer userId;
    private String username;
    private String userEmail;
    private Integer parentId;
    private String body;
    private String status;
    private LocalDateTime createdAt;
}
