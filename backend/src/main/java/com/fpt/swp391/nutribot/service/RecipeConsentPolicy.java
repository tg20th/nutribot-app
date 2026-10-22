package com.fpt.swp391.nutribot.service;

/**
 * NB-87: Nguồn duy nhất cho chính sách đồng thuận dùng công thức của tác giả.
 * Khi điều khoản thay đổi, tăng CURRENT_TERMS_VERSION để buộc tác giả đồng thuận lại.
 */
public final class RecipeConsentPolicy {

    public static final String CURRENT_TERMS_VERSION = "v1";

    private RecipeConsentPolicy() {
    }
}
