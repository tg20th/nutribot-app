package com.fpt.swp391.nutribot.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserResponse {

    private Integer userId;
    private String username;
    private String email;
    private String fullName;
    private String roleName;
    private String status;
    private Integer strikeCount;
    private LocalDateTime createdAt;
}
