package com.fpt.swp391.nutribot.dto.response;

import lombok.Builder;

import java.math.BigDecimal;
import java.util.List;

@Builder
public record HealthProfileResponse(
        BigDecimal heightCm,
        BigDecimal weightKg,
        BigDecimal bmi,
        String bmiCategory,
        String healthGoal,
        List<Integer> allergyIngredientIds,
        List<String> allergies
) {
}
