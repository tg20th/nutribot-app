package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NutritionCalculationRequest {

    @Min(value = 1, message = "Số khẩu phần ít nhất là 1")
    private Integer servings;

    private String dishName;

    @NotEmpty(message = "Danh sách nguyên liệu không được để trống")
    private List<IngredientItem> ingredients;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IngredientItem {
        private String name;
        private Double quantity;
        private String unit;
    }
}
