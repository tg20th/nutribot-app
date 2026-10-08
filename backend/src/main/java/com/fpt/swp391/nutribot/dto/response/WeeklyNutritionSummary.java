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
public class WeeklyNutritionSummary {
    private String status;
    private NutritionMetrics actual;
    private NutritionMetrics target;
    private NutritionMetrics percentage;
    private List<String> missingFields;
}
