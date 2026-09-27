package com.fpt.swp391.nutribot.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WeeklyMenuResponse {

    private Integer menuId;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer targetCalories;
    private String status;
    private List<MealResponse> meals;
    private List<DailyCaloriesResponse> dailyTotals;
    private long totalCalories;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MealResponse {
        private Integer mealId;
        private Integer dayOfWeek;
        private String mealType;
        private List<ItemResponse> items;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ItemResponse {
        private Integer itemId;
        private Integer dishId;
        private String dishName;
        private Integer calories;
        private BigDecimal proteinG;
        private String imageUrl;
        private BigDecimal servings;
        private String notes;
        private Integer totalCalories;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyCaloriesResponse {
        private Integer dayOfWeek;
        private long totalCalories;
    }
}
