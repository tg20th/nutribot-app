package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IngredientUpdateRequest {
    @NotBlank
    @Size(max = 150)
    private String name;

    @NotBlank
    @Size(max = 180)
    private String slug;

    @Size(max = 500)
    private String description;

    @NotNull
    private Integer categoryId;
}
