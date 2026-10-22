package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.service.RecipeExtractionGatewayService.IngredientProposal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * NB-86: Đọc hai cột JSON do AI trích xuất ({@code ingredients_json},
 * {@code recipe_steps_json}) và phân biệt rõ giữa "danh sách rỗng" với "JSON
 * hỏng". Trước đây service nuốt lỗi parse và trả về danh sách rỗng, khiến Admin
 * duyệt nhầm một công thức không có nguyên liệu/bước làm.
 */
@Slf4j
@Component
public class RecipeSuggestionPayloadReader {

    private static final TypeReference<List<IngredientProposal>> INGREDIENTS_TYPE =
            new TypeReference<>() {};
    private static final TypeReference<List<String>> STEPS_TYPE = new TypeReference<>() {};

    private final ObjectMapper objectMapper;

    public RecipeSuggestionPayloadReader(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public ParsedPayload<List<IngredientProposal>> readIngredients(String json) {
        if (json == null || json.isBlank()) {
            return ParsedPayload.ok(List.of());
        }
        try {
            List<IngredientProposal> parsed = objectMapper.readValue(json, INGREDIENTS_TYPE);
            return ParsedPayload.ok(parsed == null ? List.of() : parsed);
        } catch (Exception ex) {
            log.warn("Không đọc được ingredients_json của đề xuất: {}", ex.getMessage());
            return ParsedPayload.failed();
        }
    }

    public ParsedPayload<List<String>> readSteps(String json) {
        if (json == null || json.isBlank()) {
            return ParsedPayload.ok(List.of());
        }
        try {
            List<String> parsed = objectMapper.readValue(json, STEPS_TYPE);
            return ParsedPayload.ok(parsed == null ? List.of() : parsed);
        } catch (Exception ex) {
            log.warn("Không đọc được recipe_steps_json của đề xuất: {}", ex.getMessage());
            return ParsedPayload.failed();
        }
    }

    public record ParsedPayload<T>(T value, boolean malformed) {

        public static <T> ParsedPayload<T> ok(T value) {
            return new ParsedPayload<>(value, false);
        }

        public static <T> ParsedPayload<T> failed() {
            return new ParsedPayload<>(null, true);
        }

        public boolean isEmpty() {
            return malformed || value == null;
        }
    }
}
