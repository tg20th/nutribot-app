package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.entity.Content;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Kiểm thử ContentRecipeBodyParser (NB-60 hướng lai)")
class ContentRecipeBodyParserTest {

    private final ContentRecipeBodyParser parser = new ContentRecipeBodyParser(new ObjectMapper());

    private Content content(String title, String body) {
        return Content.builder().contentId(1).title(title).body(body).build();
    }

    @Test
    @DisplayName("Parse đầy đủ body JSON và suy ra tên món từ tiêu đề")
    void parse_fullBody_success() {
        String body = "{\"version\":1,\"story\":\"câu chuyện\",\"prepMinutes\":20,\"cookMinutes\":15,\"servings\":3,"
                + "\"nutrition\":{\"calories\":320,\"proteinG\":13.5,\"carbsG\":38.0,\"fatG\":12.4,\"fiberG\":5.2,\"sodiumMg\":410},"
                + "\"ingredients\":[{\"name\":\"Bột gạo\",\"quantity\":\"200\",\"unit\":\"g\",\"isCustom\":false},"
                + "{\"customName\":\"Gia vị nhà làm\",\"quantity\":\"1\",\"unit\":\"muỗng\",\"isCustom\":true}],"
                + "\"steps\":[\"Trộn bột\",\"Chiên vàng\"]}";

        var result = parser.parse(content("Chia sẻ cách làm Bánh xèo chay giòn rụm", body));

        assertNotNull(result);
        assertEquals("Bánh xèo chay giòn rụm", result.dish().name());
        assertEquals("câu chuyện", result.dish().description());
        assertEquals(320, result.nutrition().calories());
        assertEquals(0, new BigDecimal("13.5").compareTo(result.nutrition().proteinG()));
        assertEquals(2, result.ingredients().size());
        assertEquals("Bột gạo", result.ingredients().get(0).name());
        assertEquals(0, new BigDecimal("200").compareTo(result.ingredients().get(0).quantity()));
        assertEquals("Gia vị nhà làm", result.ingredients().get(1).name());
        assertEquals(20, result.recipe().prepTimeMin());
        assertEquals(15, result.recipe().cookTimeMin());
        assertEquals(3, result.recipe().servings());
        assertEquals(2, result.recipe().steps().size());
    }

    @Test
    @DisplayName("Bỏ tiền tố ở các định dạng tiêu đề khác nhau")
    void stripTitlePrefix_variants() {
        assertEquals("Phở cuốn chay", ContentRecipeBodyParser.stripTitlePrefix("Chia sẻ cách làm Phở cuốn chay"));
        assertEquals("Cơm tấm chay", ContentRecipeBodyParser.stripTitlePrefix("Góc bếp: Cơm tấm chay"));
        assertEquals("Súp bí đỏ", ContentRecipeBodyParser.stripTitlePrefix("Video hướng dẫn Súp bí đỏ"));
        assertEquals("Món giữ nguyên", ContentRecipeBodyParser.stripTitlePrefix("Món giữ nguyên"));
    }

    @Test
    @DisplayName("Quantity dạng chuỗi có đơn vị và dấu phẩy vẫn parse được")
    void parseQuantity_toleratesUnitsAndComma() {
        String body = "{\"ingredients\":[{\"name\":\"Đường\",\"quantity\":\"1,5 muỗng\"},"
                + "{\"name\":\"Muối\",\"quantity\":\"một chút\"}],\"steps\":[\"Nấu\"]}";

        var result = parser.parse(content("Góc bếp: Chè đậu", body));

        assertNotNull(result);
        assertEquals(0, new BigDecimal("1.5").compareTo(result.ingredients().get(0).quantity()));
        assertNull(result.ingredients().get(1).quantity());
    }

    @Test
    @DisplayName("Dùng instructions khi không có steps")
    void parse_stepsFallbackToInstructions() {
        String body = "{\"ingredients\":[{\"name\":\"Cà rốt\"}],\"instructions\":[\"Sơ chế\",\"Nấu\"]}";

        var result = parser.parse(content("Góc bếp: Canh cà rốt", body));

        assertNotNull(result);
        assertEquals(2, result.recipe().steps().size());
    }

    @Test
    @DisplayName("Trả null khi body không phải JSON")
    void parse_nonJson_returnsNull() {
        assertNull(parser.parse(content("Góc bếp: Canh rau", "Nguyên liệu và cách làm...")));
        assertNull(parser.parse(content("Góc bếp: Canh rau", "<h2>Recipe details</h2>")));
    }

    @Test
    @DisplayName("Trả null khi không có tiêu đề để suy ra tên món")
    void parse_blankTitle_returnsNull() {
        assertNull(parser.parse(content("   ", "{\"steps\":[\"Nấu\"]}")));
        assertNull(parser.parse(null));
    }
}
