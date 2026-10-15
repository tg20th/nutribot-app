package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class ChatAttachmentRequest {

    @NotBlank(message = "Loại đính kèm không được trống")
    @Pattern(regexp = "IMAGE|VIDEO", message = "Loại đính kèm phải là IMAGE hoặc VIDEO")
    private String type;

    @NotBlank(message = "Dữ liệu base64 không được trống")
    @Size(max = 40_000_000, message = "Dữ liệu đính kèm vượt quá kích thước cho phép")
    private String dataBase64;

    @NotBlank(message = "MIME type không được trống")
    @Size(max = 50, message = "MIME type không hợp lệ")
    private String mimeType;

    @Size(max = 255, message = "Tên file quá dài")
    private String filename;
}
