package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VideoDetailResponse {

    @JsonProperty("contentId")
    private Integer contentId;

    @JsonProperty("title")
    private String title;

    @JsonProperty("body")
    private String body;

    @JsonProperty("mediaUrl")
    private String mediaUrl;

    @JsonProperty("thumbnailUrl")
    private String thumbnailUrl;

    @JsonProperty("durationSec")
    private Integer durationSec;

    @JsonProperty("categoryId")
    private Integer categoryId;
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

    @JsonProperty("authorId")
    private Integer authorId;

    @JsonProperty("authorName")
    private String authorName;

    @JsonProperty("viewCount")
    private Integer viewCount;

    @JsonProperty("voteCount")
    private Integer voteCount;

    @JsonProperty("userVoted")
    private Boolean userVoted;

    @JsonProperty("createdAt")
    private LocalDateTime createdAt;
}
