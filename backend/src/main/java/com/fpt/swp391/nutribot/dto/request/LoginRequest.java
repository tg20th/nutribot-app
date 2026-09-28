package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginRequest {

    @NotBlank(message = "Username hoặc email không được để trống")
    @Size(max = 255, message = "Username hoặc email tối đa 255 ký tự")
    private String usernameOrEmail;

    @NotBlank(message = "Mật khẩu không được để trống")
    @Size(max = 128, message = "Mật khẩu tối đa 128 ký tự")
    private String password;
}
