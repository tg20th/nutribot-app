package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginRequest {

    @NotBlank(message = "Username or email is required.")
    @Size(max = 255, message = "Username or email must not exceed 255 characters.")
    private String usernameOrEmail;

    @NotBlank(message = "Password is required.")
    @Size(max = 128, message = "Password must not exceed 128 characters.")
    private String password;
}
