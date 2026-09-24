package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CommentResponse {

    @JsonProperty("commentId")
    private Integer commentId;

    @JsonProperty("contentId")
    private Integer contentId;

    @JsonProperty("userId")
    private Integer userId;

    @JsonProperty("userName")
    private String userName;

    @JsonProperty("userAvatar")
    private String userAvatar;

    @JsonProperty("parentId")
    private Integer parentId;

    @JsonProperty("body")
    private String body;

    @JsonProperty("createdAt")
    private LocalDateTime createdAt;

    @JsonProperty("replies")
    private List<CommentResponse> replies;
}
