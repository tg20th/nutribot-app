package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminCommentStatusRequest {

    @NotBlank(message = "Trạng thái không được để trống")
    @Pattern(regexp = "(?i)^(published|hidden|rejected)$",
            message = "Trạng thái phải là PUBLISHED, HIDDEN hoặc REJECTED")
    private String status;

    private String reason;
}
