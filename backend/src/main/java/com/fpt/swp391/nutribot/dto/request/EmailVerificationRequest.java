package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class EmailVerificationRequest {

    @NotBlank(message = "Verification code is required.")
    @Pattern(regexp = "^\\d{6}$", message = "Enter the six-digit verification code.")
    private String otp;
}
