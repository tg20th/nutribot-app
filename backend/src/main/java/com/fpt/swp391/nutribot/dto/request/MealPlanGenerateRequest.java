package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class MealPlanGenerateRequest {

    @Size(max = 50, message = "Mục tiêu sức khỏe không hợp lệ")
    @jakarta.validation.constraints.Pattern(
            regexp = "^(lose_weight|gain_muscle|maintain|maintain_weight)?$",
            message = "Mục tiêu sức khỏe không hợp lệ"
    )
    private String healthGoal;

    @Size(max = 40, message = "Tối đa 40 nguyên liệu có sẵn")
    private List<@Size(max = 100, message = "Tên nguyên liệu quá dài") String> availableIngredients;

    @Size(max = 30, message = "Tối đa 30 nguyên liệu cần loại trừ")
    private List<@Size(max = 100, message = "Tên nguyên liệu quá dài") String> excludedAllergies;

    @Size(max = 30, message = "Chế độ ăn chay không hợp lệ")
    private String vegetarianType;

    private NutritionTargetRequest nutritionTarget;

    @Data
    public static class NutritionTargetRequest {
        private Double calories;
        private Double proteinG;
        private Double carbsG;
        private Double fatG;
        private Boolean estimated = false;
    }
}
