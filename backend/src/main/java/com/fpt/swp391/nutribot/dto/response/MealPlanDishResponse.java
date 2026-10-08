package com.fpt.swp391.nutribot.dto.response;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class MealPlanDishResponse {
    private Integer dishId;
    private String dishName;
    private Integer calories;
    private BigDecimal proteinG;
    private BigDecimal carbsG;
    private BigDecimal healthyFatsG;
    private String imageUrl;
    private BigDecimal servings;
}
