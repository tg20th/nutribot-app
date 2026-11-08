package com.fpt.swp391.nutribot.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.regex.Pattern;

/**
 * Tiện ích chuẩn hóa nội dung văn bản và tạo mã băm SHA-256 phục vụ chống trùng lặp (NB-97).
 */
public final class ContentTextNormalizer {

    private static final Pattern PUNCTUATION_PATTERN = Pattern.compile("[^\\p{L}\\p{Nd}\\s]");
    private static final Pattern MULTI_SPACE_PATTERN = Pattern.compile("\\s+");

    private ContentTextNormalizer() {
    }

    /**
     * Bóc tách văn bản thô, loại bỏ thẻ HTML, dấu câu, chuẩn hóa khoảng trắng và chuyển chữ thường.
     *
     * @param htmlContent chuỗi nội dung (có thể chứa HTML từ rich text editor)
     * @return chuỗi văn bản thuần túy đã chuẩn hóa
     */
    public static String extractPlainText(String content) {
        if (content == null || content.isBlank()) {
            return "";
        }
        String normalizedPlainText = AuthorContentService.normalizeBody(content);
        String strippedPunctuation = PUNCTUATION_PATTERN.matcher(normalizedPlainText).replaceAll(" ");
        return MULTI_SPACE_PATTERN.matcher(strippedPunctuation).replaceAll(" ").trim().toLowerCase();
    }

    /**
     * Chuẩn hóa tiêu đề: loại bỏ khoảng trắng thừa ở hai đầu và giữa các từ.
     */
    public static String normalizeTitle(String title) {
        if (title == null || title.isBlank()) {
            return "";
        }
        return MULTI_SPACE_PATTERN.matcher(title.trim()).replaceAll(" ");
    }

    /**
     * Tính mã băm SHA-256 (64 ký tự hex) của nội dung đã chuẩn hóa.
     * Dùng để so khớp trùng lặp 100% nội dung (Mức 1).
     *
     * @param htmlContent nội dung bài viết
     * @return chuỗi hex 64 ký tự hoặc chuỗi rỗng nếu nội dung trống
     */
    public static String computeContentHash(String htmlContent) {
        String plain = extractPlainText(htmlContent);
        if (plain.isBlank()) {
            return "";
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(plain.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Không tìm thấy thuật toán băm SHA-256", e);
        }
    }
}
