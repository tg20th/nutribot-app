package com.fpt.swp391.nutribot.dto.response;

import lombok.Builder;
import lombok.Value;
import java.time.LocalDateTime;

@Value @Builder
public class UserModerationActionResponse {
    Long actionId; Integer userId; Integer adminId; String action; String source; String reason; String additionalExplanation;
    String previousStatus; String newStatus; Short strikeDelta; LocalDateTime createdAt;
}
