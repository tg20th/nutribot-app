package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * NB-84: Mot dong nhat ky vong doi trang thai cua de xuat cong thuc.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecipeSuggestionAuditResponse {

    private Integer auditId;
    private Integer suggestionId;
    private String action;
    private Integer actorId;
    private String actorName;
    private String reason;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
}
