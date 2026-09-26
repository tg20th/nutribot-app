package com.fpt.swp391.nutribot.dto.response;

import lombok.Data;

@Data
public class MealPlanDayResponse {
    private String day;
    private String breakfast;
    private String lunch;
    private String dinner;
}
