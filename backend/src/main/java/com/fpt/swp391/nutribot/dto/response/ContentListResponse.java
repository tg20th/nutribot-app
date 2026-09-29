package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContentListResponse {

    @JsonProperty("contentId")
    private Integer contentId;

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

    @JsonProperty("avatarUrl")
    private String avatarUrl;

    @JsonProperty("viewCount")
    private Integer viewCount;

    @JsonProperty("voteCount")
    private Integer voteCount;

    @JsonProperty("createdAt")
    private LocalDateTime createdAt;
}
