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
    private List<String> steps;
    private Integer servings;
    private Integer prepTimeMin;
    private Integer cookTimeMin;
    private List<IngredientDetailDto> ingredients;
    private Integer sourceAuthorId;
    private Integer contributorUserId;
    private String sourceAuthorName;
    private String sourceAuthorAvatar;
    private Integer sourceContentId;
    private Integer sourcePostId;
    private String sourceType;
    private String contributorName;
    private String sourcePostTitle;
    private Integer approvedBy;
    private java.time.LocalDateTime approvedAt;
}
