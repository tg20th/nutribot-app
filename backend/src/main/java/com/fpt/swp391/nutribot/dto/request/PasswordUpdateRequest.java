package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PasswordUpdateRequest {

    /**
     * Mật khẩu hiện tại.
     * Bắt buộc với tài khoản đã có mật khẩu (hasPassword = true).
     * Bỏ qua/không bắt buộc với tài khoản Google OAuth chưa từng đặt mật khẩu (hasPassword = false).
     */
    private String currentPassword;

    @NotBlank(message = "New password is required.")
    @Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
        message = "New password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character (@$!%*?&)."
    )
    private String newPassword;

    @NotBlank(message = "Please confirm your new password.")
    private String confirmPassword;
}
