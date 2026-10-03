package com.fpt.swp391.nutribot.entity;

/**
 * Trạng thái tài khoản người dùng chuẩn hóa toàn hệ thống NutriBot.
 * Map 1:1 với ràng buộc CSDL:
 * CONSTRAINT CK_users_status CHECK (status IN (N'ACTIVE', N'WARN', N'BANNED', N'PENDING_VERIFY'))
 */
public enum AccountStatus {
    ACTIVE,
    WARN,
    BANNED,
    PENDING_VERIFY;

    public static AccountStatus fromString(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String clean = status.trim().toUpperCase();

        // Backward compatibility: map SUSPENDED -> BANNED
        if ("SUSPENDED".equals(clean)) {
            return BANNED;
        }

        for (AccountStatus s : values()) {
            if (s.name().equals(clean)) {
                return s;
            }
        }
        throw new IllegalArgumentException("Trạng thái tài khoản không hợp lệ: " + status);
    }
}
