package com.fpt.swp391.nutribot.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Kiểm thử TokenBlacklistService (BL-029: Thu hồi Token Server-side)")
class TokenBlacklistServiceTest {

    private TokenBlacklistService blacklistService;

    @BeforeEach
    void setUp() {
        blacklistService = new TokenBlacklistService();
    }

    @Test
    @DisplayName("Thêm token còn hạn vào blacklist và kiểm tra thành công")
    void testBlacklistTokenAndIsBlacklisted() {
        String token = "valid.jwt.token.signature";
        Date futureExpiry = new Date(System.currentTimeMillis() + 60_000); // 1 phút sau

        assertFalse(blacklistService.isBlacklisted(token));

        blacklistService.blacklistToken(token, futureExpiry);

        assertTrue(blacklistService.isBlacklisted(token));
        assertEquals(1, blacklistService.getBlacklistSize());
    }

    @Test
    @DisplayName("Token khác không bị ảnh hưởng bởi token trong blacklist")
    void testDifferentTokensAreIndependent() {
        String token1 = "token.one.signature";
        String token2 = "token.two.signature";
        Date futureExpiry = new Date(System.currentTimeMillis() + 60_000);

        blacklistService.blacklistToken(token1, futureExpiry);

        assertTrue(blacklistService.isBlacklisted(token1));
        assertFalse(blacklistService.isBlacklisted(token2));
    }

    @Test
    @DisplayName("Không thêm token đã hết hạn tự nhiên vào blacklist")
    void testExpiredTokenNotAddedToBlacklist() {
        String token = "already.expired.token";
        Date pastExpiry = new Date(System.currentTimeMillis() - 10_000); // 10 giây trước

        blacklistService.blacklistToken(token, pastExpiry);

        assertFalse(blacklistService.isBlacklisted(token));
        assertEquals(0, blacklistService.getBlacklistSize());
    }

    @Test
    @DisplayName("Xử lý an toàn khi token null hoặc chuỗi trắng")
    void testNullOrBlankTokenHandledGracefully() {
        assertFalse(blacklistService.isBlacklisted(null));
        assertFalse(blacklistService.isBlacklisted(""));
        assertFalse(blacklistService.isBlacklisted("   "));

        assertDoesNotThrow(() -> blacklistService.blacklistToken(null, new Date()));
        assertDoesNotThrow(() -> blacklistService.blacklistToken("", new Date()));
        assertDoesNotThrow(() -> blacklistService.blacklistToken("token", null));
    }

    @Test
    @DisplayName("Dọn dẹp các token đã quá hạn khỏi blacklist")
    void testCleanUpExpiredTokens() throws InterruptedException {
        String shortLivedToken = "short.lived.token";
        Date almostExpired = new Date(System.currentTimeMillis() + 50); // 50ms nữa hết hạn

        blacklistService.blacklistToken(shortLivedToken, almostExpired);
        assertTrue(blacklistService.isBlacklisted(shortLivedToken));

        Thread.sleep(60);

        // Sau khi đã quá hạn, isBlacklisted tự động dọn dẹp hoặc cleanUpExpiredTokens dọn dẹp
        blacklistService.cleanUpExpiredTokens();
        assertFalse(blacklistService.isBlacklisted(shortLivedToken));
        assertEquals(0, blacklistService.getBlacklistSize());
    }
}
