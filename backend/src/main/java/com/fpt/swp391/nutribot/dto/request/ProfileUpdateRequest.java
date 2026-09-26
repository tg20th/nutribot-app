package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfileUpdateRequest {

    @NotBlank(message = "Username is required.")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters.")
    private String username;

    @NotBlank(message = "Email is required.")
    @Email(message = "Email must be valid.")
    @Size(max = 255, message = "Email must not exceed 255 characters.")
    private String email;

    @Size(max = 150, message = "Full name must not exceed 150 characters.")
    private String fullName;

    @Size(max = 500, message = "Bio must not exceed 500 characters.")
    private String bio;

    @PastOrPresent(message = "Date of birth must not be in the future.")
    private LocalDate dateOfBirth;

    @Size(max = 20, message = "Gender must not exceed 20 characters.")
    private String gender;
}
