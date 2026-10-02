package com.fpt.swp391.nutribot.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NutritionSummary {
    private NutritionMetrics actual;
    private NutritionMetrics target;
    private NutritionMetrics percentage;
}
