package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PersonalizedFeedResponse {

    @JsonProperty("items")
    private List<FeedItemResponse> items;

    @JsonProperty("nextCursor")
    private String nextCursor;

    @JsonProperty("total")
    private Integer total;

    @JsonProperty("fallback")
    private Boolean fallback;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FeedItemResponse {

        @JsonProperty("contentId")
        private Integer contentId;

        @JsonProperty("contentType")
        private String contentType;

        @JsonProperty("title")
        private String title;

        @JsonProperty("slug")
        private String slug;

        @JsonProperty("thumbnailUrl")
        private String thumbnailUrl;

        @JsonProperty("categoryId")
        private Integer categoryId;

        @JsonProperty("authorId")
        private Integer authorId;

        @JsonProperty("authorUsername")
        private String authorUsername;

        @JsonProperty("authorName")
        private String authorName;

        @JsonProperty("authorAvatar")
        private String authorAvatar;

        @JsonProperty("viewCount")
        private Integer viewCount;

        @JsonProperty("voteCount")
        private Integer voteCount;

        @JsonProperty("createdAt")
        private String createdAt;

        @JsonProperty("recommendationReason")
        private String recommendationReason;
    }
}
