package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.RecipeSuggestionValidation;
import com.fpt.swp391.nutribot.dto.response.RecipeValidationIssue;
import com.fpt.swp391.nutribot.dto.response.ResolvedRecipeIngredient;
import com.fpt.swp391.nutribot.dto.request.RecipeIngredientMapping;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestion;
import com.fpt.swp391.nutribot.service.RecipeExtractionGatewayService.IngredientProposal;
import com.fpt.swp391.nutribot.service.RecipeSuggestionPayloadReader.ParsedPayload;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static com.fpt.swp391.nutribot.dto.response.RecipeValidationIssue.SEVERITY_ERROR;
import static com.fpt.swp391.nutribot.dto.response.RecipeValidationIssue.SEVERITY_WARNING;

/**
 * NB-86: Kiểm tra dữ liệu đề xuất công thức trước khi Admin duyệt. Mục tiêu là
 * không cho dữ liệu thiếu/âm/null đi vào canonical catalog, vì Meal Planner và
 * Weekly Menu sẽ coi món thiếu nutrition là 0 kcal và bỏ qua món chay không xác
 * định được loại.
 *
 * <p>ERROR chặn duyệt (HTTP 422), WARNING chỉ hiển thị để Admin cân nhắc.
 */
@Component
public class RecipeSuggestionValidator {

    private static final int MAX_DISH_NAME_LENGTH = 150;
    private static final int MAX_RECIPE_TITLE_LENGTH = 200;
    private static final int MAX_INGREDIENT_NAME_LENGTH = 150;
    private static final int MAX_UNIT_LENGTH = 30;
    private static final int MAX_STEP_COUNT = 50;
    private static final int MAX_STEP_LENGTH = 2000;
    private static final int MAX_SERVING_UNIT_LENGTH = 30;
    private static final BigDecimal NUTRITION_TOLERANCE = new BigDecimal("0.20");
    private static final BigDecimal ZERO = BigDecimal.ZERO;

    private final RecipeSuggestionPayloadReader payloadReader;
    private final VegetarianTypeClassifier vegetarianTypeClassifier;
    private final RecipeDuplicateDetector duplicateDetector;
    private final RecipeIngredientResolver ingredientResolver;
    private final int maxServings;

    public RecipeSuggestionValidator(
            RecipeSuggestionPayloadReader payloadReader,
            VegetarianTypeClassifier vegetarianTypeClassifier,
            RecipeDuplicateDetector duplicateDetector,
            @Value("${app.content-recipe-suggestion.max-servings:50}") int maxServings) {
        this(payloadReader, vegetarianTypeClassifier, duplicateDetector, maxServings, null);
    }

    @Autowired
    public RecipeSuggestionValidator(
            RecipeSuggestionPayloadReader payloadReader,
            VegetarianTypeClassifier vegetarianTypeClassifier,
            RecipeDuplicateDetector duplicateDetector,
            @Value("${app.content-recipe-suggestion.max-servings:50}") int maxServings,
            RecipeIngredientResolver ingredientResolver) {
        this.payloadReader = payloadReader;
        this.vegetarianTypeClassifier = vegetarianTypeClassifier;
        this.duplicateDetector = duplicateDetector;
        this.maxServings = maxServings;
        this.ingredientResolver = ingredientResolver;
    }

    public RecipeSuggestionValidation validate(ContentRecipeSuggestion suggestion) {
        return validate(suggestion, null);
    }

    public RecipeSuggestionValidation validate(ContentRecipeSuggestion suggestion, List<RecipeIngredientMapping> mappings) {
        if (suggestion == null) {
            List<RecipeValidationIssue> issues = new ArrayList<>();
            addIssue(issues, SEVERITY_ERROR, "suggestion", "SUGGESTION_REQUIRED",
                    "Không có dữ liệu đề xuất để kiểm tra");
            return build(issues, null, VegetarianTypeClassifier.Status.UNKNOWN, false);
        }

        List<RecipeValidationIssue> issues = new ArrayList<>();
        validateDishName(suggestion.getDishName(), issues);
        validateRecipeTitle(suggestion.getRecipeTitle(), issues);

        IngredientsCheck ingredientsCheck = validateIngredients(suggestion.getIngredientsJson(), issues);
        validateSteps(suggestion.getRecipeStepsJson(), issues);
        validateServings(suggestion.getServings(), issues);
        validateNutrition(suggestion, issues);
        validateServingInfo(suggestion, issues);

        RecipeIngredientResolver.Resolution resolution = ingredientResolver == null ? null
                : ingredientResolver.resolve(ingredientsCheck.ingredients(), mappings);
        List<String> classificationNames = resolution == null
                ? ingredientNames(ingredientsCheck.ingredients())
                : resolution.ingredients().stream().map(r -> r.getIngredientName() != null
                        ? r.getIngredientName() : r.getProposedName()).toList();
        VegetarianTypeClassifier.Verdict verdict = vegetarianTypeClassifier.evaluate(classificationNames);
        if (ingredientsCheck.present()) {
            if (verdict.status() == VegetarianTypeClassifier.Status.NON_VEGETARIAN) {
                addIssue(issues, SEVERITY_ERROR, "ingredients", "NON_VEGETARIAN_INGREDIENT",
                        "Đề xuất chứa nguyên liệu động vật nên không thể nhập vào catalog thuần chay: "
                                + String.join(", ", verdict.animalIngredients()));
            } else if (verdict.status() == VegetarianTypeClassifier.Status.UNKNOWN) {
                addIssue(issues, SEVERITY_ERROR, "ingredients", "VEGETARIAN_TYPE_UNKNOWN",
                        "Không xác định được loại ăn chay từ danh sách nguyên liệu");
            }
        }

        if (duplicateDetector != null && ingredientsCheck.present()) {
            issues.addAll(duplicateDetector.detect(suggestion, ingredientsCheck.ingredients()));
        }

        if (resolution != null) issues.addAll(resolution.issues());
        RecipeSuggestionValidation result = build(issues, verdict.type(), verdict.status(),
                "PENDING".equalsIgnoreCase(suggestion.getStatus()));
        result.setIngredientResolutions(resolution == null ? List.of() : resolution.ingredients());
        return result;
    }

    private RecipeSuggestionValidation build(
            List<RecipeValidationIssue> issues,
            String vegetarianType,
            VegetarianTypeClassifier.Status verdictStatus,
            boolean pending) {
        boolean valid = issues.stream().noneMatch(issue -> SEVERITY_ERROR.equals(issue.getSeverity()));
        return RecipeSuggestionValidation.builder()
                .valid(valid)
                .canApprove(valid && pending)
                .vegetarianType(vegetarianType)
                .vegetarianVerdict(verdictStatus != null ? verdictStatus.name() : null)
                .issues(issues)
                .build();
    }

    private void validateDishName(String dishName, List<RecipeValidationIssue> issues) {
        String trimmed = dishName == null ? "" : dishName.trim();
        if (trimmed.isEmpty()) {
            addIssue(issues, SEVERITY_ERROR, "dish.name", "DISH_NAME_REQUIRED",
                    "Đề xuất thiếu tên món ăn");
            return;
        }
        if (trimmed.length() > MAX_DISH_NAME_LENGTH) {
            addIssue(issues, SEVERITY_ERROR, "dish.name", "DISH_NAME_TOO_LONG",
                    "Tên món ăn vượt quá " + MAX_DISH_NAME_LENGTH + " ký tự");
        }
    }

    private void validateRecipeTitle(String recipeTitle, List<RecipeValidationIssue> issues) {
        if (recipeTitle == null || recipeTitle.isBlank()) {
            return;
        }
        if (recipeTitle.trim().length() > MAX_RECIPE_TITLE_LENGTH) {
            addIssue(issues, SEVERITY_ERROR, "recipe.title", "RECIPE_TITLE_TOO_LONG",
                    "Tiêu đề công thức vượt quá " + MAX_RECIPE_TITLE_LENGTH + " ký tự");
        }
    }

    private IngredientsCheck validateIngredients(String json, List<RecipeValidationIssue> issues) {
        ParsedPayload<List<IngredientProposal>> payload = payloadReader.readIngredients(json);
        if (payload.malformed()) {
            addIssue(issues, SEVERITY_ERROR, "ingredients", "INGREDIENTS_JSON_INVALID",
                    "Dữ liệu nguyên liệu bị hỏng, không đọc được");
            return new IngredientsCheck(List.of(), false);
        }
        List<IngredientProposal> proposals = payload.value();
        if (proposals.isEmpty()) {
            addIssue(issues, SEVERITY_ERROR, "ingredients", "INGREDIENTS_REQUIRED",
                    "Đề xuất công thức phải có ít nhất một nguyên liệu");
            return new IngredientsCheck(List.of(), false);
        }

        Set<String> seenNames = new HashSet<>();
        for (int index = 0; index < proposals.size(); index++) {
            IngredientProposal proposal = proposals.get(index);
            String field = "ingredients[" + index + "]";
            if (proposal == null) {
                addIssue(issues, SEVERITY_ERROR, field, "INGREDIENT_ENTRY_INVALID",
                        "Nguyên liệu không đúng định dạng");
                continue;
            }

            String name = proposal.name() == null ? "" : proposal.name().trim();
            if (name.isEmpty()) {
                addIssue(issues, SEVERITY_ERROR, field + ".name", "INGREDIENT_NAME_REQUIRED",
                        "Nguyên liệu thứ " + (index + 1) + " thiếu tên");
            } else {
                if (name.length() > MAX_INGREDIENT_NAME_LENGTH) {
                    addIssue(issues, SEVERITY_ERROR, field + ".name", "INGREDIENT_NAME_TOO_LONG",
                            "Tên nguyên liệu vượt quá " + MAX_INGREDIENT_NAME_LENGTH + " ký tự");
                }
                String key = RecipeTextNormalizer.normalizeName(name);
                if (!seenNames.add(key)) {
                    addIssue(issues, SEVERITY_ERROR, field + ".name", "INGREDIENT_DUPLICATED",
                            "Nguyên liệu \"" + name + "\" bị lặp lại trong công thức");
                }
            }

            if (proposal.quantity() == null) {
                addIssue(issues, SEVERITY_ERROR, field + ".quantity", "INGREDIENT_QUANTITY_REQUIRED",
                        "Nguyên liệu \"" + name + "\" thiếu định lượng");
            } else if (proposal.quantity().compareTo(ZERO) <= 0) {
                addIssue(issues, SEVERITY_ERROR, field + ".quantity", "INGREDIENT_QUANTITY_INVALID",
                        "Định lượng của \"" + name + "\" phải lớn hơn 0");
            }
            if (proposal.quantity() != null && (proposal.quantity().precision() - proposal.quantity().scale() > 8
                    || proposal.quantity().scale() > 2)) {
                addIssue(issues, SEVERITY_ERROR, field + ".quantity", "INGREDIENT_QUANTITY_INVALID",
                        "Định lượng vượt giới hạn lưu trữ (tối đa 10 chữ số, 2 chữ số thập phân)");
            }

            String unit = proposal.unit() == null ? "" : proposal.unit().trim();
            if (unit.isEmpty()) {
                addIssue(issues, SEVERITY_ERROR, field + ".unit", "INGREDIENT_UNIT_REQUIRED",
                        "Nguyên liệu \"" + name + "\" thiếu đơn vị đo");
            } else if (unit.length() > MAX_UNIT_LENGTH) {
                addIssue(issues, SEVERITY_ERROR, field + ".unit", "INGREDIENT_UNIT_TOO_LONG",
                        "Đơn vị đo của \"" + name + "\" vượt quá " + MAX_UNIT_LENGTH + " ký tự");
            }
            if (proposal.notes() != null && proposal.notes().length() > 200) {
                addIssue(issues, SEVERITY_ERROR, field + ".notes", "INGREDIENT_NOTES_TOO_LONG",
                        "Ghi chú nguyên liệu không được vượt quá 200 ký tự");
            }

        }
        return new IngredientsCheck(Collections.unmodifiableList(new ArrayList<>(proposals)), true);
    }

    private void validateSteps(String json, List<RecipeValidationIssue> issues) {
        ParsedPayload<List<String>> payload = payloadReader.readSteps(json);
        if (payload.malformed()) {
            addIssue(issues, SEVERITY_ERROR, "recipe.steps", "STEPS_JSON_INVALID",
                    "Dữ liệu các bước làm bị hỏng, không đọc được");
            return;
        }
        List<String> nonBlankSteps = payload.value().stream()
                .filter(step -> step != null && !step.isBlank())
                .toList();
        if (nonBlankSteps.isEmpty()) {
            addIssue(issues, SEVERITY_ERROR, "recipe.steps", "STEPS_REQUIRED",
                    "Đề xuất công thức phải có ít nhất một bước làm");
            return;
        }
        if (nonBlankSteps.size() > MAX_STEP_COUNT) {
            addIssue(issues, SEVERITY_ERROR, "recipe.steps", "TOO_MANY_STEPS",
                    "Công thức có quá " + MAX_STEP_COUNT + " bước làm");
        }
        for (int index = 0; index < nonBlankSteps.size(); index++) {
            if (nonBlankSteps.get(index).trim().length() > MAX_STEP_LENGTH) {
                addIssue(issues, SEVERITY_ERROR, "recipe.steps[" + index + "]", "STEP_TOO_LONG",
                        "Bước làm thứ " + (index + 1) + " vượt quá " + MAX_STEP_LENGTH + " ký tự");
            }
        }
    }

    private void validateServings(Integer servings, List<RecipeValidationIssue> issues) {
        if (servings == null) {
            addIssue(issues, SEVERITY_ERROR, "recipe.servings", "SERVINGS_REQUIRED",
                    "Công thức thiếu số khẩu phần");
            return;
        }
        if (servings <= 0) {
            addIssue(issues, SEVERITY_ERROR, "recipe.servings", "SERVINGS_INVALID",
                    "Số khẩu phần phải lớn hơn 0");
        } else if (servings > maxServings) {
            addIssue(issues, SEVERITY_ERROR, "recipe.servings", "SERVINGS_EXCEEDED",
                    "Số khẩu phần vượt quá giới hạn " + maxServings);
        }
    }

    private void validateNutrition(ContentRecipeSuggestion suggestion, List<RecipeValidationIssue> issues) {
        Integer calories = suggestion.getCalories();
        if (calories == null) {
            addIssue(issues, SEVERITY_ERROR, "nutrition.calories", "CALORIES_REQUIRED",
                    "Công thức thiếu năng lượng (calories)");
        } else if (calories <= 0) {
            addIssue(issues, SEVERITY_ERROR, "nutrition.calories", "CALORIES_INVALID",
                    "Năng lượng phải lớn hơn 0");
        }

        validateMacro(suggestion.getProteinG(), "nutrition.proteinG", "PROTEIN", "protein", issues);
        validateMacro(suggestion.getCarbsG(), "nutrition.carbsG", "CARBS", "carbs", issues);
        validateMacro(suggestion.getFatG(), "nutrition.fatG", "FAT", "chất béo", issues);

        BigDecimal fiber = suggestion.getFiberG();
        if (fiber == null) {
            addIssue(issues, SEVERITY_WARNING, "nutrition.fiberG", "FIBER_MISSING",
                    "Công thức thiếu chất xơ (fiber), nên bổ sung để tính khẩu phần chính xác hơn");
        } else if (fiber.compareTo(ZERO) < 0) {
            addIssue(issues, SEVERITY_WARNING, "nutrition.fiberG", "FIBER_INVALID",
                    "Chất xơ không được âm");
        }

        validateNutritionConsistency(suggestion, issues);
    }

    private void validateMacro(
            BigDecimal value,
            String field,
            String codePrefix,
            String label,
            List<RecipeValidationIssue> issues) {
        if (value == null) {
            addIssue(issues, SEVERITY_ERROR, field, codePrefix + "_REQUIRED",
                    "Công thức thiếu " + label);
        } else if (value.compareTo(ZERO) < 0) {
            addIssue(issues, SEVERITY_ERROR, field, codePrefix + "_INVALID",
                    label + " không được âm");
        }
    }

    private void validateNutritionConsistency(ContentRecipeSuggestion suggestion, List<RecipeValidationIssue> issues) {
        Integer calories = suggestion.getCalories();
        BigDecimal protein = suggestion.getProteinG();
        BigDecimal carbs = suggestion.getCarbsG();
        BigDecimal fat = suggestion.getFatG();
        if (calories == null || calories <= 0 || protein == null || carbs == null || fat == null) {
            return;
        }
        if (protein.compareTo(ZERO) < 0 || carbs.compareTo(ZERO) < 0 || fat.compareTo(ZERO) < 0) {
            return;
        }
        BigDecimal expected = protein.multiply(BigDecimal.valueOf(4))
                .add(carbs.multiply(BigDecimal.valueOf(4)))
                .add(fat.multiply(BigDecimal.valueOf(9)));
        BigDecimal deviation = expected.subtract(BigDecimal.valueOf(calories)).abs()
                .divide(BigDecimal.valueOf(calories), 4, RoundingMode.HALF_UP);
        if (deviation.compareTo(NUTRITION_TOLERANCE) > 0) {
            addIssue(issues, SEVERITY_WARNING, "nutrition.calories", "NUTRITION_INCONSISTENT",
                    "Năng lượng khai báo lệch quá 20% so với tổng macro (ước tính "
                            + expected.setScale(0, RoundingMode.HALF_UP) + " kcal)");
        }
    }

    private void validateServingInfo(ContentRecipeSuggestion suggestion, List<RecipeValidationIssue> issues) {
        BigDecimal servingSize = suggestion.getServingSize();
        String servingUnit = suggestion.getServingUnit();
        boolean unitBlank = servingUnit == null || servingUnit.isBlank();

        if (servingSize == null && unitBlank) {
            addIssue(issues, SEVERITY_WARNING, "dish.serving", "SERVING_INFO_MISSING",
                    "Món ăn chưa có khối lượng và đơn vị khẩu phần");
            return;
        }
        if (servingSize == null) {
            addIssue(issues, SEVERITY_WARNING, "dish.servingSize", "SERVING_SIZE_MISSING",
                    "Món ăn thiếu khối lượng khẩu phần");
        } else if (servingSize.compareTo(ZERO) <= 0) {
            addIssue(issues, SEVERITY_ERROR, "dish.servingSize", "SERVING_SIZE_INVALID",
                    "Khối lượng khẩu phần phải lớn hơn 0");
        }
        if (unitBlank) {
            addIssue(issues, SEVERITY_WARNING, "dish.servingUnit", "SERVING_UNIT_MISSING",
                    "Món ăn thiếu đơn vị khẩu phần");
        } else if (servingUnit.trim().length() > MAX_SERVING_UNIT_LENGTH) {
            addIssue(issues, SEVERITY_ERROR, "dish.servingUnit", "SERVING_UNIT_TOO_LONG",
                    "Đơn vị khẩu phần vượt quá " + MAX_SERVING_UNIT_LENGTH + " ký tự");
        }
    }

    private List<String> ingredientNames(List<IngredientProposal> ingredients) {
        return ingredients.stream()
                .filter(java.util.Objects::nonNull)
                .map(IngredientProposal::name)
                .filter(name -> name != null && !name.isBlank())
                .toList();
    }

    private static void addIssue(
            List<RecipeValidationIssue> issues,
            String severity,
            String field,
            String code,
            String message) {
        issues.add(RecipeValidationIssue.builder()
                .field(field)
                .code(code)
                .severity(severity)
                .message(message)
                .build());
    }

    private record IngredientsCheck(List<IngredientProposal> ingredients, boolean present) {
    }
}
