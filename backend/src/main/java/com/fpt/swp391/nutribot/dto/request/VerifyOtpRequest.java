package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VerifyOtpRequest {

    @NotBlank(message = "Email is required.")
    @Email(message = "Please enter a valid email address.")
    private String email;

    @NotBlank(message = "Verification code is required.")
    @Size(min = 6, max = 6, message = "Verification code must be 6 digits.")
    private String otpCode;
}
