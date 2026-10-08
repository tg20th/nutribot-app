package com.fpt.swp391.nutribot.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NutritionMetrics {
    private Long calories;
    private BigDecimal proteinG;
    private BigDecimal carbsG;
    private BigDecimal healthyFatsG;
}
