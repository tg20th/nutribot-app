package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthorContentResponse {

    @JsonProperty("contentId")
    private Integer contentId;

    @JsonProperty("contentType")
    private String contentType;

    @JsonProperty("title")
    private String title;

    @JsonProperty("slug")
    private String slug;

    @JsonProperty("body")
    private String body;

    @JsonProperty("categoryId")
    private Integer categoryId;

    @JsonProperty("mediaUrl")
    private String mediaUrl;

    @JsonProperty("thumbnailUrl")
    private String thumbnailUrl;

    @JsonProperty("durationSec")
    private Integer durationSec;

    @JsonProperty("status")
    private String status;

    @JsonProperty("authorId")
    private Integer authorId;

    @JsonProperty("authorUsername")
    private String authorUsername;

    @JsonProperty("authorName")
    private String authorName;

    @JsonProperty("authorAvatar")
    private String authorAvatar;

    @JsonProperty("avatarUrl")
    private String avatarUrl;

    @JsonProperty("viewCount")
    private Integer viewCount;

    @JsonProperty("createdAt")
    private LocalDateTime createdAt;

    @JsonProperty("updatedAt")
    private LocalDateTime updatedAt;
}
