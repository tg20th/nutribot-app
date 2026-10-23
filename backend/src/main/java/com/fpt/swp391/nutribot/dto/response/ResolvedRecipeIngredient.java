package com.fpt.swp391.nutribot.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResolvedRecipeIngredient {
    private Integer proposalIndex;
    private String proposedName;
    private Integer ingredientId;
    private String ingredientName;
    private String status;
}
