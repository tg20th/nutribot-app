package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.entity.Content;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * NB-60 (hướng lai): Trích xuất công thức trực tiếp từ {@code content.body} dạng JSON
 * do cộng đồng đăng tải, KHÔNG phụ thuộc AI. Đây là nguồn chính, tất định và không tốn
 * quota; AI chỉ được gọi khi body không parse được hoặc thiếu thông tin cốt lõi.
 *
 * <p>Tên món được suy ra từ tiêu đề nội dung (bỏ tiền tố hiển thị) để đảm bảo khớp
 * chính xác với món trong hệ thống và ổn định qua các lần quét.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ContentRecipeBodyParser {

    /** Tiền tố hiển thị thường gặp trong tiêu đề; thứ tự quan trọng (dài trước). */
    private static final String[] TITLE_PREFIXES = {
            "Chia sẻ cách làm ",
            "Video hướng dẫn ",
            "Góc bếp: ",
            "Góc bếp:",
            "Hướng dẫn "
    };

    private static final Pattern NUMBER_PATTERN = Pattern.compile("\\d+(?:[.,]\\d+)?");

    private final ObjectMapper objectMapper;

    /**
     * Parse {@code content.body} JSON thành kết quả trích xuất.
     *
     * @return kết quả trích xuất, hoặc {@code null} nếu không thể suy ra tên món hoặc
     *         body không phải JSON hợp lệ (khi đó tầng gọi sẽ fallback sang AI).
     */
    public RecipeExtractionGatewayService.RecipeExtractionResult parse(Content content) {
        if (content == null) {
            return null;
        }
        String dishName = stripTitlePrefix(content.getTitle());
        if (dishName == null || dishName.isBlank()) {
            return null;
        }

        JsonNode root = readJson(content.getBody());
        if (root == null || !root.isObject()) {
            return null;
        }

        String story = text(root.get("story"));
        JsonNode nutritionNode = root.get("nutrition");

        RecipeExtractionGatewayService.DishProposal dish =
                new RecipeExtractionGatewayService.DishProposal(
                        dishName, story, null, null);

        RecipeExtractionGatewayService.NutritionProposal nutrition =
                nutritionNode != null && nutritionNode.isObject()
                        ? new RecipeExtractionGatewayService.NutritionProposal(
                                intValue(nutritionNode.get("calories")),
                                decimalValue(nutritionNode.get("proteinG")),
                                decimalValue(nutritionNode.get("carbsG")),
                                decimalValue(nutritionNode.get("fatG")),
                                decimalValue(nutritionNode.get("fiberG")))
                        : null;

        List<RecipeExtractionGatewayService.IngredientProposal> ingredients =
                readIngredients(root.get("ingredients"));
        List<String> steps = readStringArray(root, "steps", "instructions");

        RecipeExtractionGatewayService.RecipeProposal recipe =
                new RecipeExtractionGatewayService.RecipeProposal(
                        dishName,
                        story,
                        intValue(root.get("prepMinutes")),
                        intValue(root.get("cookMinutes")),
                        intValue(root.get("servings")),
                        steps);

        return new RecipeExtractionGatewayService.RecipeExtractionResult(
                dish, nutrition, ingredients, recipe);
    }

    private JsonNode readJson(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        String trimmed = body.trim();
        if (!trimmed.startsWith("{")) {
            return null;
        }
        try {
            return objectMapper.readTree(trimmed);
        } catch (Exception ex) {
            log.debug("Body không phải JSON hợp lệ, sẽ fallback AI: {}", ex.getMessage());
            return null;
        }
    }

    private List<RecipeExtractionGatewayService.IngredientProposal> readIngredients(JsonNode node) {
        List<RecipeExtractionGatewayService.IngredientProposal> result = new ArrayList<>();
        if (node == null || !node.isArray()) {
            return result;
        }
        for (JsonNode item : node) {
            if (item == null || !item.isObject()) {
                continue;
            }
            boolean custom = item.path("isCustom").asBoolean(false);
            String name = custom ? firstNonBlank(text(item.get("customName")), text(item.get("name")))
                    : text(item.get("name"));
            if (name == null || name.isBlank()) {
                continue;
            }
            result.add(new RecipeExtractionGatewayService.IngredientProposal(
                    name.trim(),
                    parseQuantity(item.get("quantity")),
                    text(item.get("unit")),
                    text(item.get("notes"))));
        }
        return result;
    }

    private List<String> readStringArray(JsonNode root, String preferred, String alternative) {
        List<String> values = toList(root.get(preferred));
        if (values.isEmpty()) {
            values = toList(root.get(alternative));
        }
        return values;
    }

    private List<String> toList(JsonNode node) {
        List<String> values = new ArrayList<>();
        if (node == null || !node.isArray()) {
            return values;
        }
        for (JsonNode item : node) {
            String value = text(item);
            if (value != null && !value.isBlank()) {
                values.add(value.trim());
            }
        }
        return values;
    }

    private static BigDecimal parseQuantity(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        String raw = node.asText("").trim();
        if (raw.isEmpty()) {
            return null;
        }
        Matcher matcher = NUMBER_PATTERN.matcher(raw);
        if (!matcher.find()) {
            return null;
        }
        try {
            return new BigDecimal(matcher.group().replace(',', '.'));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static Integer intValue(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isNumber()) {
            return node.asInt();
        }
        String raw = node.asText("").trim();
        if (raw.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(raw).intValue();
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static BigDecimal decimalValue(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isNumber()) {
            return node.decimalValue();
        }
        String raw = node.asText("").trim();
        if (raw.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(raw.replace(',', '.'));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String text(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        String value = node.asText();
        return value == null ? null : value.trim();
    }

    private static String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second;
    }

    static String stripTitlePrefix(String title) {
        if (title == null) {
            return null;
        }
        String result = title.trim();
        for (String prefix : TITLE_PREFIXES) {
            if (result.regionMatches(true, 0, prefix, 0, prefix.length())) {
                result = result.substring(prefix.length()).trim();
                break;
            }
        }
        return result;
    }
}
