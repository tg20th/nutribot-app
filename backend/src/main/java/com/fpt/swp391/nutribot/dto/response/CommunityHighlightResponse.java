package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Compact public-content projection used by the Community right rail. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CommunityHighlightResponse {

    @JsonProperty("contentId")
    private Integer contentId;

    @JsonProperty("contentType")
    private String contentType;

    @JsonProperty("title")
    private String title;

    @JsonProperty("thumbnailUrl")
    private String thumbnailUrl;

    @JsonProperty("authorId")
    private Integer authorId;

    @JsonProperty("authorUsername")
    private String authorUsername;

    @JsonProperty("authorName")
    private String authorName;

    @JsonProperty("authorAvatar")
    private String authorAvatar;

    @JsonProperty("voteCount")
    private Long voteCount;

    @JsonProperty("commentCount")
    private Long commentCount;

    @JsonProperty("createdAt")
    private LocalDateTime createdAt;
}
