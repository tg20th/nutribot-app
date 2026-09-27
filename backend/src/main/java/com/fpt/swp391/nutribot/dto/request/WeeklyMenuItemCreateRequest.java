package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WeeklyMenuItemCreateRequest {

    @NotNull
    @Min(1)
    @Max(7)
    private Integer dayOfWeek;

    @NotBlank
    @Size(max = 20)
    private String mealType;

    @NotNull
    @Positive
    private Integer dishId;

    @NotNull
    @DecimalMin("0.01")
    @Digits(integer = 2, fraction = 2)
    private BigDecimal servings;

    @Size(max = 300)
    private String notes;
}
