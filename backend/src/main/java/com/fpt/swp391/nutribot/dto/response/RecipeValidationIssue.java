package com.fpt.swp391.nutribot.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * NB-86: Một vấn đề (lỗi chặn duyệt hoặc cảnh báo) phát hiện khi kiểm tra dữ
 * liệu đề xuất công thức.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecipeValidationIssue {

    public static final String SEVERITY_ERROR = "ERROR";
    public static final String SEVERITY_WARNING = "WARNING";

    private String field;
    private String code;
    private String severity;
    private String message;
}
