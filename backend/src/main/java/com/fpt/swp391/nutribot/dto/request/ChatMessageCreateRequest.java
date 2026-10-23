package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter @Setter
public class ChatMessageCreateRequest {
    @NotBlank(message = "Người gửi không được trống")
    @Pattern(regexp = "USER|ASSISTANT", message = "Người gửi không hợp lệ")
    private String senderType;

    @NotBlank(message = "Nội dung không được trống")
    @Size(max = 10000, message = "Nội dung quá dài")
    private String content;

    @Size(max = 100, message = "Idempotency key quá dài")
    private String idempotencyKey;

    @Size(max = 1, message = "Chỉ được gửi tối đa một đính kèm")
    private List<@Valid ChatAttachmentRequest> attachments;

    private Map<String, Object> metadata;
}
