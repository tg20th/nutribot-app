package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

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
    private Integer prepTimeMin;
    private Integer cookTimeMin;
    private Integer servings;
    private Integer calories;
    private Double proteinG;
    private Double carbsG;
    private Double fatG;
    private Double fiberG;
    private Double sodiumMg;
    private List<String> ingredients;
    private List<String> steps;

    @JsonProperty("status")
    private String status;

    @JsonProperty("viewCount")
    private Integer viewCount;

    @JsonProperty("createdAt")
    private LocalDateTime createdAt;

    @JsonProperty("updatedAt")
    private LocalDateTime updatedAt;
}
