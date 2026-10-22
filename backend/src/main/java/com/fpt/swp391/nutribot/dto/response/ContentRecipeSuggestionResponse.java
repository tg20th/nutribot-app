package com.fpt.swp391.nutribot.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContentRecipeSuggestionResponse {

    private Integer suggestionId;
    private String status;
    private Integer dishId;
    private Integer recipeId;
    private LocalDateTime createdAt;
    private LocalDateTime reviewedAt;
    private String reviewerName;
    private String rejectionReason;

    private SourceContent sourceContent;
    private DishInfo dish;
    private NutritionInfo nutrition;
    private List<IngredientInfo> ingredients;
    private RecipeInfo recipe;
    private RestaurantInfo restaurant;
    private RecipeSuggestionValidation validation;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SourceContent {
        private Integer contentId;
        private String contentType;
        private String title;
        private String authorName;
        private Integer viewCount;
        private Integer voteCount;
        private LocalDateTime createdAt;
        private String url;
        private Boolean recipeConsent;
        private LocalDateTime recipeConsentAt;
        private String recipeConsentTermsVersion;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DishInfo {
        private String name;
        private String description;
        private BigDecimal servingSize;
        private String servingUnit;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NutritionInfo {
        private Integer calories;
        private BigDecimal proteinG;
        private BigDecimal carbsG;
        private BigDecimal fatG;
        private BigDecimal fiberG;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IngredientInfo {
        private String name;
        private BigDecimal quantity;
        private String unit;
        private String notes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecipeInfo {
        private String title;
        private String description;
        private Integer prepTimeMin;
        private Integer cookTimeMin;
        private Integer servings;
        private List<String> steps;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RestaurantInfo {
        private String name;
        private String address;
        private String reference;
    }
}
