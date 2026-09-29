package com.fpt.swp391.nutribot.dto.response;

import lombok.Builder;

@Builder
public record NutritionTargetResponse(
        boolean estimated,
        int calories,
        int proteinG,
        int carbsG,
        int healthyFatsG
) {
}
