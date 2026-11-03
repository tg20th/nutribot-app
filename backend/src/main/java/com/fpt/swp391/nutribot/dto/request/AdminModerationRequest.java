package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminModerationRequest {

    @NotBlank(message = "Action không được để trống")
    @Pattern(regexp = "APPROVE|HIDE|REJECT",
             message = "Action phải là APPROVE, HIDE hoặc REJECT")
    private String action;

    @Size(max = 1000, message = "Reason must not exceed 1000 characters")
    private String reason;
}
