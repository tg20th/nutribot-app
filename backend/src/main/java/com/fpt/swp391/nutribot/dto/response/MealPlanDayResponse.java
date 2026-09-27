package com.fpt.swp391.nutribot.dto.response;

import lombok.Data;

@Data
public class MealPlanDayResponse {
    private String day;
    private MealPlanDishResponse breakfast;
    private MealPlanDishResponse lunch;
    private MealPlanDishResponse dinner;
}
