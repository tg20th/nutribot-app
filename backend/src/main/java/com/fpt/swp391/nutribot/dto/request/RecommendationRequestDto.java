package com.fpt.swp391.nutribot.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecommendationRequestDto {

    @NotNull
    @Size(max = 5000)
    @JsonProperty("contents")
    private List<ContentCandidateDto> contents;

    @Size(max = 1000)
    @JsonProperty("interactions")
    private List<InteractionDto> interactions;

    @JsonProperty("vegetarian_type")
    private String vegetarianType;

    @NotNull
    @jakarta.validation.constraints.Min(1)
    @jakarta.validation.constraints.Max(50)
    @JsonProperty("limit")
    private Integer limit;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ContentCandidateDto {
        @JsonProperty("content_id")
        private Integer contentId;

        @JsonProperty("content_type")
        private String contentType;

        @JsonProperty("status")
        private String status;

        @JsonProperty("title")
        private String title;

        @JsonProperty("body")
        private String body;

        @JsonProperty("description")
        private String description;

        @JsonProperty("category")
        private String category;

        @JsonProperty("tags")
        private List<String> tags;

        @JsonProperty("ingredients")
        private List<String> ingredients;

        @JsonProperty("dietary_tags")
        private List<String> dietaryTags;

        @JsonProperty("view_count")
        private Integer viewCount;

        @JsonProperty("published_at")
        private String publishedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InteractionDto {
        @JsonProperty("content_id")
        private Integer contentId;

        @JsonProperty("vote")
        private Integer vote;

        @JsonProperty("active_dwell_seconds")
        private Double activeDwellSeconds;

        @JsonProperty("max_scroll_pct")
        private Double maxScrollPct;

        @JsonProperty("completed")
        private Boolean completed;
    }
}
