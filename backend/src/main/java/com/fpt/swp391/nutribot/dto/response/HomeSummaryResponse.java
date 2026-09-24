package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HomeSummaryResponse {

    @JsonProperty("featuredBlogs")
    private List<ContentListResponse> featuredBlogs;

    @JsonProperty("latestVideos")
    private List<ContentListResponse> latestVideos;

    @JsonProperty("categories")
    private List<CategoryResponse> categories;

    @JsonProperty("stats")
    private StatsResponse stats;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StatsResponse {
        @JsonProperty("totalBlogs")
        private Long totalBlogs;

        @JsonProperty("totalVideos")
        private Long totalVideos;

        @JsonProperty("totalUsers")
        private Long totalUsers;
    }
}
