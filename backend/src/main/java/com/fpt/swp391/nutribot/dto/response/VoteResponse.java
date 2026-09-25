package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoteResponse {

    @JsonProperty("contentId")
    private Integer contentId;

    @JsonProperty("voteCount")
    private Long voteCount;

    @JsonProperty("isVoted")
    private Boolean isVoted;
}
