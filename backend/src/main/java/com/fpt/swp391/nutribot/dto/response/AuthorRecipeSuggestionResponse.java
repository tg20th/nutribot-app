package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * NB-84: Tac gia xem trang thai de xuat cong thuc cua chinh bai viet cua minh.
 * Tac gia khong can vao trang quan tri de biet bai da duoc duyet hay bi tu choi.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthorRecipeSuggestionResponse {

    private Integer suggestionId;
    private String status;
    private String dishName;
    private String recipeTitle;

    private Integer contentId;
    private String contentTitle;
    private String contentType;

    /** So luot xem va like tai thoi diem sinh de xuat. */
    private Integer sourceViewCount;
    private Integer sourceVoteCount;

    /** Ly do tu choi (chi co khi status = REJECTED). */
    private String rejectionReason;

    /** Admin da xu ly de xuat (null khi de xuat do he thong tu dong tu choi do tac gia rut dong thuan). */
    private Integer reviewedBy;
    private String reviewedByName;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime reviewedAt;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime updatedAt;
}
