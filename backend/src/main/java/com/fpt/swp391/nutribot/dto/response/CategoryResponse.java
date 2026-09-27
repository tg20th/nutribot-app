package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryResponse {

    @JsonProperty("categoryId")
    private Integer categoryId;

    @JsonProperty("categoryName")
    private String categoryName;

    @JsonProperty("slug")
    private String slug;

    @JsonProperty("iconUrl")
    private String iconUrl;

    @JsonProperty("contentCount")
    private Long contentCount;

    @JsonProperty("categoryType")
    private String categoryType;

    @JsonProperty("description")
    private String description;

    @JsonProperty("active")
    private Boolean active;
}
