package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PublicProfileStats {

    @JsonProperty("publishedBlogCount")
    private long publishedBlogCount;

    @JsonProperty("publishedVideoCount")
    private long publishedVideoCount;

    @JsonProperty("verifiedRecipeCount")
    private long verifiedRecipeCount;

    @JsonProperty("totalContributions")
    private long totalContributions;
}
