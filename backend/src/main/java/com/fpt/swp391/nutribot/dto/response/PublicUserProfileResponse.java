package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PublicUserProfileResponse {

    @JsonProperty("userId")
    private Integer userId;

    @JsonProperty("username")
    private String username;

    @JsonProperty("fullName")
    private String fullName;

    @JsonProperty("avatarUrl")
    private String avatarUrl;

    @JsonProperty("bio")
    private String bio;

    @JsonProperty("role")
    private String role;

    @JsonProperty("joinedAt")
    private LocalDateTime joinedAt;

    @JsonProperty("stats")
    private PublicProfileStats stats;
}
