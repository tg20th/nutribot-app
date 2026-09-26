package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class MealPlanGenerateRequest {

    @NotNull(message = "Mục tiêu calo là bắt buộc")
    @Min(value = 1000, message = "Mục tiêu calo phải từ 1000 kcal")
    @Max(value = 4500, message = "Mục tiêu calo không được vượt quá 4500 kcal")
    private Integer targetCalories;

    @NotBlank(message = "Mục tiêu sức khỏe là bắt buộc")
    @Pattern(regexp = "lose_weight|maintain_weight|gain_muscle|maintain", message = "Mục tiêu sức khỏe không hợp lệ")
    private String healthGoal;

    @NotEmpty(message = "Cần ít nhất một nguyên liệu có sẵn")
    @Size(max = 40, message = "Tối đa 40 nguyên liệu có sẵn")
    private List<@NotBlank(message = "Tên nguyên liệu không được để trống") @Size(max = 100, message = "Tên nguyên liệu quá dài") String> availableIngredients;

    @Size(max = 30, message = "Tối đa 30 nguyên liệu cần loại trừ")
    private List<@NotBlank(message = "Tên nguyên liệu cần loại trừ không được để trống") @Size(max = 100, message = "Tên nguyên liệu quá dài") String> excludedAllergies;
}
