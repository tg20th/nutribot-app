package com.fpt.swp391.nutribot.entity;

/**
 * Enum phân quyền người dùng chuẩn hóa toàn hệ thống NutriBot.
 * Map với Spring Security GrantedAuthority và bảng roles trong Database.
 */
public enum RoleName {
    ROLE_USER("ROLE_USER"),
    ROLE_ADMIN("ROLE_ADMIN"),
    ROLE_EXPERT("ROLE_EXPERT");

    private final String authority;

    RoleName(String authority) {
        this.authority = authority;
    }

    public String getAuthority() {
        return authority;
    }

    public static RoleName fromString(String roleName) {
        if (roleName == null || roleName.isBlank()) {
            return null;
        }
        String clean = roleName.trim().toUpperCase();
        if (clean.equals("USER") || clean.equals("ROLE_USER")) {
            return ROLE_USER;
        }
        if (clean.equals("ADMIN") || clean.equals("ROLE_ADMIN")) {
            return ROLE_ADMIN;
        }
        if (clean.equals("EXPERT") || clean.equals("ROLE_EXPERT")) {
            return ROLE_EXPERT;
        }
        for (RoleName r : values()) {
            if (r.name().equalsIgnoreCase(clean) || r.authority.equalsIgnoreCase(clean)) {
                return r;
            }
        }
        throw new IllegalArgumentException("Role không hợp lệ: " + roleName);
    }
}
