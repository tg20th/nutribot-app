package com.fpt.swp391.nutribot.exception;

import com.fpt.swp391.nutribot.dto.response.RecipeValidationIssue;
import lombok.Getter;

import java.util.List;

/**
 * NB-86: Dữ liệu đề xuất công thức chưa đủ điều kiện nhập vào catalog. Trả về
 * HTTP 422 kèm danh sách lỗi theo từng trường để Admin biết chính xác cần bổ
 * sung gì.
 */
@Getter
public class RecipeValidationException extends RuntimeException {

    private final List<RecipeValidationIssue> issues;

    public RecipeValidationException(List<RecipeValidationIssue> issues) {
        super("Dữ liệu đề xuất công thức chưa hợp lệ để duyệt");
        this.issues = issues == null ? List.of() : List.copyOf(issues);
    }

    public RecipeValidationException(String message, List<RecipeValidationIssue> issues) {
        super(message);
        this.issues = issues == null ? List.of() : List.copyOf(issues);
    }
}
