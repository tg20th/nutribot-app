package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegisterRequest {

    @NotBlank(message = "Username is required.")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters.")
    private String username;

    @NotBlank(message = "Email is required.")
    @Email(message = "Please enter a valid email address.")
    private String email;

    @NotBlank(message = "Password is required.")
    @Size(min = 8, message = "Password must be at least 8 characters.")
    @Pattern(
        regexp = "^[A-Za-z\\d@$!%*?&]*$",
        message = "Password may only contain letters, numbers and the characters @$!%*?&."
    )
    @Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&]).*$",
        message = "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number and 1 special character."
    )
    private String password;

    @Size(max = 150, message = "Full name must not exceed 150 characters.")
    private String fullName;
}
