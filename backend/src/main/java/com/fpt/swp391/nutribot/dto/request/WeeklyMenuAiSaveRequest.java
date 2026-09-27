package com.fpt.swp391.nutribot.dto.request;

import com.fpt.swp391.nutribot.dto.response.MealPlanGenerateResponse;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class WeeklyMenuAiSaveRequest {

    @NotNull
    private LocalDate startDate;

    @Size(max = 100)
    private String dietaryGoal;

    @NotNull
    @Valid
    private MealPlanGenerateResponse generatedMenu;
}
