package com.fpt.swp391.nutribot.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecipeDetailDto {

    private Integer recipeId;
    private String title;
    private String description;
    private String instructions;
    private Integer servings;
    private Integer prepTimeMin;
    private Integer cookTimeMin;
    private List<IngredientDetailDto> ingredients;
}
