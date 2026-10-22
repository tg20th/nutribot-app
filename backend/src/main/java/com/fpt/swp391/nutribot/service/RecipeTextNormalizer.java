package com.fpt.swp391.nutribot.service;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * NB-86: Chuẩn hóa chuỗi dùng chung cho việc sinh slug và so khớp tên món /
 * nguyên liệu. Tách ra khỏi service duyệt đề xuất để validator và bộ dò trùng
 * dùng chung một quy tắc duy nhất.
 */
public final class RecipeTextNormalizer {

    private static final Pattern COMBINING_MARKS = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");

    private RecipeTextNormalizer() {
    }

    public static String slugify(String input) {
        if (input == null) {
            return "";
        }
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD);
        String ascii = COMBINING_MARKS.matcher(normalized).replaceAll("")
                .replace('đ', 'd')
                .replace('Đ', 'D');
        return ascii.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }

    public static String normalizeName(String input) {
        if (input == null) {
            return "";
        }
        return input.trim()
                .replaceAll("\\s+", " ")
                .toLowerCase(Locale.ROOT);
    }
}
