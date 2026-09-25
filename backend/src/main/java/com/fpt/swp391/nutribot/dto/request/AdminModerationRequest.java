package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminModerationRequest {

    @NotBlank(message = "Action không được để trống")
    @Pattern(regexp = "APPROVE|HIDE|REJECT",
             message = "Action phải là APPROVE, HIDE hoặc REJECT")
    private String action;
}
