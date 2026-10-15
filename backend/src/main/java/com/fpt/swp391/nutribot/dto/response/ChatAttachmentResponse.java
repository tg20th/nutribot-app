package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatAttachmentResponse {

    private String type;
    private String url;
    private String mimeType;
    private String filename;
    private List<String> recognizedIngredients;
    private List<String> uncertainIngredients;
    private String imageContext;
    private List<String> warnings;
}
