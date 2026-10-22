package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.response.RecipeSuggestionValidation;
import com.fpt.swp391.nutribot.dto.response.RecipeValidationIssue;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestion;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử RecipeSuggestionValidator (NB-86)")
class RecipeSuggestionValidatorTest {

    @Mock
    private RecipeDuplicateDetector duplicateDetector;

    private RecipeSuggestionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new RecipeSuggestionValidator(
                new RecipeSuggestionPayloadReader(new ObjectMapper()),
                new VegetarianTypeClassifier(),
                duplicateDetector,
                50);
        lenient().when(duplicateDetector.detect(any(), any())).thenReturn(List.of());
    }

    private ContentRecipeSuggestion suggestion() {
        return ContentRecipeSuggestion.builder()
                .suggestionId(700)
                .content(Content.builder().contentId(82).build())
                .status("PENDING")
                .dishName("Bún gạo lứt rau củ")
                .dishDescription("Nhẹ bụng")
                .servingSize(BigDecimal.ONE)
                .servingUnit("bowl")
                .calories(418)
                .proteinG(new BigDecimal("15.8"))
                .carbsG(new BigDecimal("64.2"))
                .fatG(new BigDecimal("11.6"))
                .fiberG(new BigDecimal("9.4"))
                .ingredientsJson("[{\"name\":\"Bún gạo lứt\",\"quantity\":90,\"unit\":\"g\"},"
                        + "{\"name\":\"Cà rốt\",\"quantity\":50,\"unit\":\"g\"}]")
                .recipeTitle("Bún gạo lứt rau củ")
                .recipeDescription("Công thức")
                .prepTimeMin(12)
                .cookTimeMin(10)
                .servings(1)
                .recipeStepsJson("[\"Ngâm bún\",\"Áp chảo\"]")
                .build();
    }

    private Set<String> codes(RecipeSuggestionValidation validation) {
        return validation.getIssues().stream()
                .map(RecipeValidationIssue::getCode)
                .collect(Collectors.toSet());
    }

    @Test
    @DisplayName("Dữ liệu đầy đủ hợp lệ và xác định được loại chay")
    void validPayload_passes() {
        RecipeSuggestionValidation validation = validator.validate(suggestion());

        assertTrue(validation.isValid());
        assertTrue(validation.isCanApprove());
        assertEquals("VEGETARIAN", validation.getVegetarianVerdict());
        assertEquals(VegetarianTypeClassifier.VEGAN, validation.getVegetarianType());
        assertTrue(validation.getIssues().isEmpty());
    }

    @Test
    @DisplayName("Thiếu tên món bị chặn duyệt")
    void blankDishName_error() {
        ContentRecipeSuggestion suggestion = suggestion();
        suggestion.setDishName("   ");

        RecipeSuggestionValidation validation = validator.validate(suggestion);

        assertFalse(validation.isValid());
        assertTrue(codes(validation).contains("DISH_NAME_REQUIRED"));
        assertEquals("dish.name", validation.getIssues().get(0).getField());
    }

    @Test
    @DisplayName("Tên món quá dài bị chặn duyệt")
    void tooLongDishName_error() {
        ContentRecipeSuggestion suggestion = suggestion();
        suggestion.setDishName("a".repeat(151));

        assertTrue(codes(validator.validate(suggestion)).contains("DISH_NAME_TOO_LONG"));
    }

    @Test
    @DisplayName("Nguyên liệu rỗng bị chặn duyệt")
    void emptyIngredients_error() {
        ContentRecipeSuggestion suggestion = suggestion();
        suggestion.setIngredientsJson("[]");

        RecipeSuggestionValidation validation = validator.validate(suggestion);

        assertFalse(validation.isValid());
        assertTrue(codes(validation).contains("INGREDIENTS_REQUIRED"));
    }

    @Test
    @DisplayName("JSON nguyên liệu hỏng bị chặn duyệt thay vì coi như rỗng")
    void malformedIngredientsJson_error() {
        ContentRecipeSuggestion suggestion = suggestion();
        suggestion.setIngredientsJson("not-a-json");

        assertTrue(codes(validator.validate(suggestion)).contains("INGREDIENTS_JSON_INVALID"));
    }

    @Test
    @DisplayName("Thiếu định lượng hoặc định lượng bằng 0 bị chặn duyệt")
    void invalidQuantity_error() {
        ContentRecipeSuggestion missing = suggestion();
        missing.setIngredientsJson("[{\"name\":\"Cà rốt\",\"unit\":\"g\"}]");
        assertTrue(codes(validator.validate(missing)).contains("INGREDIENT_QUANTITY_REQUIRED"));

        ContentRecipeSuggestion zero = suggestion();
        zero.setIngredientsJson("[{\"name\":\"Cà rốt\",\"quantity\":0,\"unit\":\"g\"}]");
        assertTrue(codes(validator.validate(zero)).contains("INGREDIENT_QUANTITY_INVALID"));
    }

    @Test
    @DisplayName("Thiếu đơn vị đo bị chặn duyệt")
    void blankUnit_error() {
        ContentRecipeSuggestion suggestion = suggestion();
        suggestion.setIngredientsJson("[{\"name\":\"Cà rốt\",\"quantity\":50,\"unit\":\"  \"}]");

        assertTrue(codes(validator.validate(suggestion)).contains("INGREDIENT_UNIT_REQUIRED"));
    }

    @Test
    @DisplayName("Nguyên liệu lặp lại bị chặn duyệt")
    void duplicatedIngredient_error() {
        ContentRecipeSuggestion suggestion = suggestion();
        suggestion.setIngredientsJson("[{\"name\":\"Cà rốt\",\"quantity\":50,\"unit\":\"g\"},"
                + "{\"name\":\" cà rốt \",\"quantity\":30,\"unit\":\"g\"}]");

        assertTrue(codes(validator.validate(suggestion)).contains("INGREDIENT_DUPLICATED"));
    }

    @Test
    @DisplayName("Thiếu bước làm bị chặn duyệt")
    void emptySteps_error() {
        ContentRecipeSuggestion suggestion = suggestion();
        suggestion.setRecipeStepsJson("[\"   \"]");

        assertTrue(codes(validator.validate(suggestion)).contains("STEPS_REQUIRED"));
    }

    @Test
    @DisplayName("JSON bước làm hỏng bị chặn duyệt")
    void malformedStepsJson_error() {
        ContentRecipeSuggestion suggestion = suggestion();
        suggestion.setRecipeStepsJson("{\"step\":1}");

        assertTrue(codes(validator.validate(suggestion)).contains("STEPS_JSON_INVALID"));
    }

    @Test
    @DisplayName("Thiếu số khẩu phần hoặc vượt giới hạn bị chặn duyệt")
    void invalidServings_error() {
        ContentRecipeSuggestion missing = suggestion();
        missing.setServings(null);
        assertTrue(codes(validator.validate(missing)).contains("SERVINGS_REQUIRED"));

        ContentRecipeSuggestion tooMany = suggestion();
        tooMany.setServings(51);
        assertTrue(codes(validator.validate(tooMany)).contains("SERVINGS_EXCEEDED"));
    }

    @Test
    @DisplayName("Thiếu calories hoặc macro âm bị chặn duyệt")
    void invalidNutrition_error() {
        ContentRecipeSuggestion noCalories = suggestion();
        noCalories.setCalories(null);
        assertTrue(codes(validator.validate(noCalories)).contains("CALORIES_REQUIRED"));

        ContentRecipeSuggestion negativeProtein = suggestion();
        negativeProtein.setProteinG(new BigDecimal("-1"));
        assertTrue(codes(validator.validate(negativeProtein)).contains("PROTEIN_INVALID"));

        ContentRecipeSuggestion missingCarbs = suggestion();
        missingCarbs.setCarbsG(null);
        assertTrue(codes(validator.validate(missingCarbs)).contains("CARBS_REQUIRED"));
    }

    @Test
    @DisplayName("Thiếu fiber chỉ là cảnh báo, vẫn có thể duyệt")
    void missingFiber_warningOnly() {
        ContentRecipeSuggestion suggestion = suggestion();
        suggestion.setFiberG(null);

        RecipeSuggestionValidation validation = validator.validate(suggestion);

        assertTrue(validation.isValid());
        assertTrue(validation.isCanApprove());
        assertTrue(codes(validation).contains("FIBER_MISSING"));
    }

    @Test
    @DisplayName("Calories lệch quá 20% so với macro chỉ là cảnh báo")
    void inconsistentNutrition_warningOnly() {
        ContentRecipeSuggestion suggestion = suggestion();
        suggestion.setCalories(900);

        RecipeSuggestionValidation validation = validator.validate(suggestion);

        assertTrue(validation.isValid());
        assertTrue(codes(validation).contains("NUTRITION_INCONSISTENT"));
    }

    @Test
    @DisplayName("Nguyên liệu động vật chặn duyệt và nêu rõ nguyên liệu vi phạm")
    void nonVegetarianIngredient_error() {
        ContentRecipeSuggestion suggestion = suggestion();
        suggestion.setIngredientsJson("[{\"name\":\"Ba chỉ heo\",\"quantity\":100,\"unit\":\"g\"}]");

        RecipeSuggestionValidation validation = validator.validate(suggestion);

        assertFalse(validation.isValid());
        assertNull(validation.getVegetarianType());
        assertEquals("NON_VEGETARIAN", validation.getVegetarianVerdict());
        RecipeValidationIssue issue = validation.getIssues().stream()
                .filter(item -> "NON_VEGETARIAN_INGREDIENT".equals(item.getCode()))
                .findFirst()
                .orElseThrow();
        assertTrue(issue.getMessage().contains("Ba chỉ heo"));
    }

    @Test
    @DisplayName("Thiếu thông tin khẩu phần chỉ là cảnh báo")
    void missingServingInfo_warningOnly() {
        ContentRecipeSuggestion suggestion = suggestion();
        suggestion.setServingSize(null);
        suggestion.setServingUnit(null);

        RecipeSuggestionValidation validation = validator.validate(suggestion);

        assertTrue(validation.isValid());
        assertTrue(codes(validation).contains("SERVING_INFO_MISSING"));
    }

    @Test
    @DisplayName("Vấn đề trùng lặp từ detector được gộp vào kết quả và chặn duyệt")
    void duplicateDetectorIssues_areMerged() {
        when(duplicateDetector.detect(any(), any())).thenReturn(List.of(RecipeValidationIssue.builder()
                .field("dish.name")
                .code("DUPLICATE_DISH_NAME")
                .severity("ERROR")
                .message("Món đã tồn tại")
                .build()));

        RecipeSuggestionValidation validation = validator.validate(suggestion());

        assertFalse(validation.isValid());
        assertFalse(validation.isCanApprove());
        assertTrue(codes(validation).contains("DUPLICATE_DISH_NAME"));
    }

    @Test
    @DisplayName("Đề xuất đã xử lý không thể duyệt lại dù dữ liệu hợp lệ")
    void nonPendingSuggestion_cannotApprove() {
        ContentRecipeSuggestion suggestion = suggestion();
        suggestion.setStatus("APPROVED");

        RecipeSuggestionValidation validation = validator.validate(suggestion);

        assertTrue(validation.isValid());
        assertFalse(validation.isCanApprove());
    }
}
