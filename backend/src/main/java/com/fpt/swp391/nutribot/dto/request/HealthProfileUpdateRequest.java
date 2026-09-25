package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class HealthProfileUpdateRequest {

    @NotNull(message = "Chiều cao là bắt buộc")
    @DecimalMin(value = "80.0", message = "Chiều cao phải từ 80 cm")
    @DecimalMax(value = "250.0", message = "Chiều cao không được vượt quá 250 cm")
    private BigDecimal heightCm;

    @NotNull(message = "Cân nặng là bắt buộc")
    @DecimalMin(value = "20.0", message = "Cân nặng phải từ 20 kg")
    @DecimalMax(value = "350.0", message = "Cân nặng không được vượt quá 350 kg")
    private BigDecimal weightKg;

    @Pattern(regexp = "lose_weight|gain_muscle|maintain", message = "Mục tiêu sức khỏe không hợp lệ")
    private String healthGoal;

    private List<Integer> allergyIngredientIds;
}
