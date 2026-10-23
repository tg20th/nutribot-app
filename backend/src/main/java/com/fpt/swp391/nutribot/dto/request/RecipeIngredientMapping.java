package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RecipeIngredientMapping {
    @NotNull
    private Integer proposalIndex;
    @NotNull
    private Integer ingredientId;
}
