package com.fpt.swp391.nutribot.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Date;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service quản lý danh sách token JWT đã bị thu hồi/đăng xuất (Server-side Token Invalidation).
 * Đóng lỗ hổng kiểm toán BL-029: chống dùng lại credential cũ sau khi logout.
 */
@Slf4j
@Service
public class TokenBlacklistService {

    private final Map<String, Instant> blacklist = new ConcurrentHashMap<>();

    public void blacklistToken(String token, Date expiresAt) {
        if (token == null || token.isBlank() || expiresAt == null) {
            return;
        }

        Instant expiryInstant = expiresAt.toInstant();
        if (expiryInstant.isBefore(Instant.now())) {
            // Token đã hết hạn tự nhiên, không cần đưa vào blacklist
            return;
        }

        String tokenHash = hashToken(token);
        blacklist.put(tokenHash, expiryInstant);
        log.info("Token has been added to server-side blacklist until {}", expiryInstant);

        // Dọn dẹp định kỳ khi kích thước danh sách tăng
        if (blacklist.size() > 500) {
            cleanUpExpiredTokens();
        }
    }

    public boolean isBlacklisted(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }

        String tokenHash = hashToken(token);
        Instant expiresAt = blacklist.get(tokenHash);

        if (expiresAt == null) {
            return false;
        }

        if (expiresAt.isBefore(Instant.now())) {
            blacklist.remove(tokenHash);
            return false;
        }

        return true;
    }

    public void cleanUpExpiredTokens() {
        Instant now = Instant.now();
        blacklist.entrySet().removeIf(entry -> entry.getValue().isBefore(now));
    }

    public int getBlacklistSize() {
        return blacklist.size();
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(token.trim().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(encodedhash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }
}
