package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContentUpdateRequest {

    @Size(max = 255, message = "Tiêu đề không được vượt quá 255 ký tự")
    private String title;

    private String body;

    private String mediaUrl;

    private String thumbnailUrl;

    private Integer durationSec;

    private String status;
}
