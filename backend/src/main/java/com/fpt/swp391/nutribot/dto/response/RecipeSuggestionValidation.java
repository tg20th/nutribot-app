package com.fpt.swp391.nutribot.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * NB-86: Kết quả kiểm tra dữ liệu một đề xuất công thức trước khi Admin duyệt.
 * {@code valid = false} nghĩa là còn ít nhất một lỗi mức ERROR và request duyệt
 * sẽ bị chặn với HTTP 422.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecipeSuggestionValidation {

    private boolean valid;
    private boolean canApprove;
    private String vegetarianType;
    private String vegetarianVerdict;
    private List<RecipeValidationIssue> issues;
}
