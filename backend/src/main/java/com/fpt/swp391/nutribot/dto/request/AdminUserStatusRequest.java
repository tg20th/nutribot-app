package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminUserStatusRequest {
    @NotBlank(message = "Account status is required")
    @Pattern(regexp = "ACTIVE|WARN|BANNED", message = "Status must be ACTIVE, WARN or BANNED")
    private String status;

    @Size(max = 500, message = "Reason must not exceed 500 characters")
    private String reason;
}
