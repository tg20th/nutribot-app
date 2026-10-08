package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NutritionCalculationResponse {

    @JsonProperty("calories")
    private Integer calories;

    @JsonProperty("proteinG")
    private Double proteinG;

    @JsonProperty("carbsG")
    private Double carbsG;

    @JsonProperty("fatG")
    private Double fatG;

    @JsonProperty("fiberG")
    private Double fiberG;

    @JsonProperty("sodiumMg")
    private Double sodiumMg;

    @JsonProperty("totalCalories")
    private Integer totalCalories;

    @JsonProperty("summary")
    private String summary;
}
