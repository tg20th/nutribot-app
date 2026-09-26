package com.fpt.swp391.nutribot.dto.response;

import lombok.Data;

import java.util.List;

@Data
public class MealPlanGenerateResponse {
    private String suggestedMenuTitle;
    private Integer estimatedDailyCalories;
    private List<MealPlanDayResponse> weeklyPlan;
}
