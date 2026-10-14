package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.Content;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Kiểm thử RecipeExtractionGatewayService (NB-60)")
class RecipeExtractionGatewayServiceTest {

    @Test
    @DisplayName("Trả về null khi content null")
    void extractRecipe_nullContent_returnsNull() {
        RecipeExtractionGatewayService service = new RecipeExtractionGatewayService("http://localhost:8000", 40);

        assertNull(service.extractRecipe(null));
    }

    @Test
    @DisplayName("Bắt lỗi kết nối graceful khi AI service offline")
    void extractRecipe_serviceOffline_returnsNull() {
        // Cổng 59998 không có service nào lắng nghe
        RecipeExtractionGatewayService service = new RecipeExtractionGatewayService("http://127.0.0.1:59998", 5);
        Content content = Content.builder()
                .contentId(1)
                .contentType("BLOG")
                .title("Bún gạo lứt rau củ")
                .body("Nguyên liệu...")
                .status("published")
                .viewCount(600)
                .build();

        assertNull(service.extractRecipe(content));
    }
}
