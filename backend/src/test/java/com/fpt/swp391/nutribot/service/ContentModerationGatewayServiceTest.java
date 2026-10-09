package com.fpt.swp391.nutribot.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Kiểm thử ContentModerationGatewayService (NB-64: Xác minh ảnh và kiểm duyệt AI)")
class ContentModerationGatewayServiceTest {

    @Test
    @DisplayName("verifyImageRelevance: Trả về MISMATCH khi URL ảnh null")
    void testVerifyImageRelevance_NullUrl() {
        ContentModerationGatewayService service = new ContentModerationGatewayService("http://localhost:8000");
        ContentModerationGatewayService.ImageRelevanceResult result =
                service.verifyImageRelevance(null, "Món salad thanh đạm", "Salad bơ", List.of("Bơ", "Rau"));

        assertNotNull(result);
        assertFalse(result.isRelevant());
        assertEquals("MISMATCH", result.matchStatus());
        assertFalse(result.isFood());
        assertEquals("URL ảnh rỗng", result.reason());
    }

    @Test
    @DisplayName("verifyImageRelevance: Trả về MISMATCH khi URL ảnh rỗng")
    void testVerifyImageRelevance_BlankUrl() {
        ContentModerationGatewayService service = new ContentModerationGatewayService("http://localhost:8000");
        ContentModerationGatewayService.ImageRelevanceResult result =
                service.verifyImageRelevance("   ", "Món salad", null, List.of());

        assertNotNull(result);
        assertFalse(result.isRelevant());
        assertEquals("MISMATCH", result.matchStatus());
    }

    @Test
    @DisplayName("verifyImageRelevance: Bắt lỗi kết nối graceful khi AI service offline")
    void testVerifyImageRelevance_ServiceOffline_GracefulFallback() {
        // Cổng 59998 không có service nào lắng nghe
        ContentModerationGatewayService service = new ContentModerationGatewayService("http://127.0.0.1:59998");
        ContentModerationGatewayService.ImageRelevanceResult result =
                service.verifyImageRelevance("https://res.cloudinary.com/demo/image/upload/sample.jpg", "Món salad", "Salad", List.of());

        assertNotNull(result);
        assertFalse(result.isRelevant());
        assertEquals("UNRECOGNIZED", result.matchStatus());
        assertTrue(result.reason().contains("kết nối") || result.reason().contains("AI service"));
    }

    @Test
    @DisplayName("moderateContent: Bắt lỗi kết nối graceful khi AI service offline")
    void testModerateContent_ServiceOffline_GracefulFallback() {
        ContentModerationGatewayService service = new ContentModerationGatewayService("http://127.0.0.1:59998");
        ContentModerationGatewayService.ModerationResult result =
                service.moderateContent(1, "BLOG", "Tiêu đề", "Mô tả", "Nội dung", "Category", List.of());

        assertNotNull(result);
        assertEquals("NEEDS_REVIEW", result.decision());
        assertTrue(result.categories().contains("AI_UNAVAILABLE"));
    }
}
