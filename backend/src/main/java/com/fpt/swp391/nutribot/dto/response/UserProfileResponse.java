package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UserProfileResponse {

    private Integer userId;
    private String username;
    private String email;
    private String fullName;
    private String avatarUrl;
    private String bio;
    private String roleName;
    private Integer strikeCount;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private BigDecimal heightCm;
    private BigDecimal weightKg;
    private BigDecimal bmi;
    private String bmiCategory;
    private String gender;
    private LocalDate dateOfBirth;
    private String healthGoal;
    private List<String> allergies;
    private String token;
}
