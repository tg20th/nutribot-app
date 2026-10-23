package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ContentRecipeSuggestionReviewRequest {

    @NotBlank(message = "Action không được để trống")
    @Pattern(regexp = "APPROVE|REJECT", message = "Action phải là APPROVE hoặc REJECT")
    private String action;

    @Size(max = 2000, message = "Lý do từ chối không vượt quá 2000 ký tự")
    private String rejectionReason;

    @Size(max = 100, message = "Không thể gửi quá 100 mapping nguyên liệu")
    private List<@jakarta.validation.Valid RecipeIngredientMapping> ingredientMappings;
}
