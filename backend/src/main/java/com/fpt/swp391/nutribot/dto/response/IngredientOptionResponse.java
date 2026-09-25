package com.fpt.swp391.nutribot.dto.response;

import lombok.Builder;

@Builder
public record IngredientOptionResponse(
        Integer ingredientId,
        String name,
        String slug,
        Integer categoryId
) {
}
