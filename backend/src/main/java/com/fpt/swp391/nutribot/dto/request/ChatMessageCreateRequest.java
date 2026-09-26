package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter; import lombok.Setter;

@Getter @Setter
public class ChatMessageCreateRequest {
    @NotBlank @Pattern(regexp = "USER|ASSISTANT", message = "Người gửi không hợp lệ") private String senderType;
    @NotBlank @Size(max = 10000) private String content;
}
