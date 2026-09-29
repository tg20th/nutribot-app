package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminUserStatusRequest {

    @NotBlank(message = "Trạng thái tài khoản không được để trống")
    @Pattern(regexp = "ACTIVE|WARN|SUSPENDED|BANNED",
             message = "Trạng thái chỉ được là ACTIVE, WARN, SUSPENDED hoặc BANNED")
    private String status;

    @Size(max = 255, message = "Lý do thay đổi trạng thái tối đa 255 ký tự")
    private String reason;
}
