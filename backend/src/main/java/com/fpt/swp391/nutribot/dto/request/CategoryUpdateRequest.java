package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryUpdateRequest {

    @NotBlank(message = "Category name is required.")
    @Size(max = 100, message = "Category name must not exceed 100 characters.")
    private String categoryName;

    @NotBlank(message = "Category slug is required.")
    @Size(max = 120, message = "Category slug must not exceed 120 characters.")
    private String slug;

    @Size(max = 500, message = "Category description must not exceed 500 characters.")
    private String description;

    @NotBlank(message = "Category type is required.")
    @Pattern(regexp = "(?i)^(INGREDIENT|RECIPE)$", message = "Category type must be INGREDIENT or RECIPE.")
    private String categoryType;

    private Boolean active;
}
