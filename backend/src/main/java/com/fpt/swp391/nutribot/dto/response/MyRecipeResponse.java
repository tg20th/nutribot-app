package com.fpt.swp391.nutribot.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MyRecipeResponse {
    private Integer dishId;
    private Integer recipeId;
    private String name;
    private String description;
    private String imageUrl;
    private Integer preparationTime;
    private Integer prepTimeMinutes;
    private Integer cookTimeMinutes;
    private Integer servings;
}
