package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;
import lombok.*;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContentCreateRequest {

    @Pattern(regexp = "(?i)BLOG|VIDEO", message = "Loại nội dung phải là BLOG hoặc VIDEO")
    private String contentType;

    @NotBlank(message = "Tiêu đề không được để trống")
    @Size(max = 255, message = "Tiêu đề không được vượt quá 255 ký tự")
    private String title;

    private String body;

    private Integer categoryId;

    @Size(max = 500, message = "Đường dẫn media không được vượt quá 500 ký tự")
    private String mediaUrl;

    @Size(max = 500, message = "Đường dẫn thumbnail không được vượt quá 500 ký tự")
    private String thumbnailUrl;

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
}
