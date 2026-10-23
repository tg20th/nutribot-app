package com.fpt.swp391.nutribot.dto.response;

import lombok.Builder;

import java.time.LocalDateTime;

@Builder
public record AdminIngredientResponse(
        Integer ingredientId,
        String name,
        String slug,
        String description,
        Integer categoryId,
        Boolean active,
        LocalDateTime createdAt
) {
}
