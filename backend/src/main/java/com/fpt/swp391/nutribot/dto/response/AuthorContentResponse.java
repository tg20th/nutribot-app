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

    @JsonProperty("recipeConsent")
    private Boolean recipeConsent;

    @JsonProperty("recipeConsentAt")
    private LocalDateTime recipeConsentAt;

    @JsonProperty("recipeConsentTermsVersion")
    private String recipeConsentTermsVersion;

    /** NB-80: Bài đã đồng thuận ĐANG đủ điều kiện đề xuất công thức (đủ view/vote, chưa có suggestion). */
    @JsonProperty("recipeConsentEligible")
    private Boolean recipeConsentEligible;

    /** NB-80: Thông báo hướng dẫn cho tác giả sau khi nộp bài có đồng thuận. */
    @JsonProperty("recipeConsentMessage")
    private String recipeConsentMessage;
}
