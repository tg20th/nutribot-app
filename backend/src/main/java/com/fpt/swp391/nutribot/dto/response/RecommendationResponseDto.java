package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecommendationResponseDto {

    @JsonProperty("items")
    private List<RecommendationItemDto> items;

    @JsonProperty("embedding_model")
    private String embeddingModel;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecommendationItemDto {
        @JsonProperty("content_id")
        private Integer contentId;

        @JsonProperty("content_type")
        private String contentType;

        @JsonProperty("score")
        private Double score;

        @JsonProperty("reason")
        private String reason;
    }
}
