package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.RecipeValidationIssue;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestion;
import com.fpt.swp391.nutribot.entity.Dish;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.entity.Recipe;
import com.fpt.swp391.nutribot.entity.RecipeIngredient;
import com.fpt.swp391.nutribot.repository.DishRepository;
import com.fpt.swp391.nutribot.repository.IngredientRepository;
import com.fpt.swp391.nutribot.repository.RecipeIngredientRepository;
import com.fpt.swp391.nutribot.repository.RecipeRepository;
import com.fpt.swp391.nutribot.service.RecipeExtractionGatewayService.IngredientProposal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * NB-86: Phát hiện đề xuất công thức trùng lặp trước khi Admin duyệt.
 *
 * <ul>
 *   <li>Bài viết nguồn đã được import → ERROR (chặn).</li>
 *   <li>Tên món trùng chính xác sau khi chuẩn hóa slug → ERROR (chặn).</li>
 *   <li>Tập nguyên liệu trùng ≥ ngưỡng Jaccard → WARNING kèm món đã có.</li>
 * </ul>
 *
 * <p>Không tự động liên kết vào Dish/Recipe có sẵn: dữ liệu cộng đồng có thể
 * khác định lượng/cách làm, nên Admin phải chủ động xử lý.
 */
@Slf4j
@Component
public class RecipeDuplicateDetector {

    private static final int MAX_CANDIDATE_RECIPES = 25;
    private static final String ERROR = RecipeValidationIssue.SEVERITY_ERROR;
    private static final String WARNING = RecipeValidationIssue.SEVERITY_WARNING;

    private final RecipeRepository recipeRepository;
    private final DishRepository dishRepository;
    private final IngredientRepository ingredientRepository;
    private final RecipeIngredientRepository recipeIngredientRepository;
    private final double similarityThreshold;

    public RecipeDuplicateDetector(
            RecipeRepository recipeRepository,
            DishRepository dishRepository,
            IngredientRepository ingredientRepository,
            RecipeIngredientRepository recipeIngredientRepository,
            @Value("${app.content-recipe-suggestion.duplicate-similarity-threshold:0.8}") double similarityThreshold) {
        this.recipeRepository = recipeRepository;
        this.dishRepository = dishRepository;
        this.ingredientRepository = ingredientRepository;
        this.recipeIngredientRepository = recipeIngredientRepository;
        this.similarityThreshold = similarityThreshold;
    }

    public List<RecipeValidationIssue> detect(
            ContentRecipeSuggestion suggestion,
            List<IngredientProposal> ingredients) {
        List<RecipeValidationIssue> issues = new ArrayList<>();
        if (suggestion == null) {
            return issues;
        }
        detectImportedSourceContent(suggestion, issues);
        detectDuplicateDishName(suggestion.getDishName(), issues);
        detectIngredientOverlap(ingredients, issues);
        return issues;
    }

    private void detectImportedSourceContent(
            ContentRecipeSuggestion suggestion,
            List<RecipeValidationIssue> issues) {
        Content content = suggestion.getContent();
        if (content == null || content.getContentId() == null) {
            return;
        }
        recipeRepository.findFirstBySourceContentId(content.getContentId())
                .ifPresent(recipe -> {
                    String dishName = resolveDishName(recipe);
                    issues.add(RecipeValidationIssue.builder()
                            .field("sourceContent")
                            .code("SOURCE_CONTENT_ALREADY_IMPORTED")
                            .severity(ERROR)
                            .message("Nội dung nguồn đã được nhập thành công thức \""
                                    + dishName + "\" (recipeId=" + recipe.getRecipeId() + ")")
                            .build());
                });
    }

    private void detectDuplicateDishName(String dishName, List<RecipeValidationIssue> issues) {
        String slug = RecipeTextNormalizer.slugify(dishName);
        if (slug.isEmpty()) {
            return;
        }
        dishRepository.findBySlug(slug).ifPresent(dish -> issues.add(RecipeValidationIssue.builder()
                .field("dish.name")
                .code("DUPLICATE_DISH_NAME")
                .severity(ERROR)
                .message("Món \"" + dish.getName() + "\" đã tồn tại trong hệ thống (dishId="
                        + dish.getDishId() + ")")
                .build()));
    }

    private void detectIngredientOverlap(
            List<IngredientProposal> ingredients,
            List<RecipeValidationIssue> issues) {
        if (ingredients == null || ingredients.isEmpty()) {
            return;
        }

        Set<Integer> suggestedIngredientIds = new LinkedHashSet<>();
        for (IngredientProposal proposal : ingredients) {
            if (proposal == null || proposal.name() == null || proposal.name().isBlank()) {
                continue;
            }
            ingredientRepository.findByNameIgnoreCase(proposal.name().trim())
                    .map(Ingredient::getIngredientId)
                    .filter(Objects::nonNull)
                    .ifPresent(suggestedIngredientIds::add);
        }
        if (suggestedIngredientIds.size() < 2) {
            return;
        }

        List<Integer> candidateRecipeIds = recipeIngredientRepository
                .findRecipeIdsByIngredientIdIn(suggestedIngredientIds).stream()
                .filter(Objects::nonNull)
                .distinct()
                .limit(MAX_CANDIDATE_RECIPES)
                .toList();
        if (candidateRecipeIds.isEmpty()) {
            return;
        }

        Map<Integer, Set<Integer>> ingredientsByRecipe = recipeIngredientRepository
                .findAllByRecipeIdIn(candidateRecipeIds).stream()
                .collect(Collectors.groupingBy(
                        RecipeIngredient::getRecipeId,
                        Collectors.mapping(RecipeIngredient::getIngredientId, Collectors.toSet())));

        int bestRecipeId = -1;
        double bestScore = 0d;
        for (Map.Entry<Integer, Set<Integer>> entry : ingredientsByRecipe.entrySet()) {
            double score = jaccard(suggestedIngredientIds, entry.getValue());
            if (score > bestScore) {
                bestScore = score;
                bestRecipeId = entry.getKey();
            }
        }
        if (bestRecipeId < 0 || bestScore < similarityThreshold) {
            return;
        }

        String dishName = recipeRepository.findById(bestRecipeId)
                .map(this::resolveDishName)
                .orElse("#" + bestRecipeId);
        issues.add(RecipeValidationIssue.builder()
                .field("ingredients")
                .code("POSSIBLE_DUPLICATE_RECIPE")
                .severity(WARNING)
                .message(String.format(Locale.ROOT,
                        "Công thức trùng khoảng %.0f%% nguyên liệu với món \"%s\" (recipeId=%d). "
                                + "Kiểm tra lại trước khi duyệt.",
                        bestScore * 100, dishName, bestRecipeId))
                .build());
    }

    private String resolveDishName(Recipe recipe) {
        if (recipe == null) {
            return "";
        }
        return Optional.ofNullable(recipe.getDishId())
                .flatMap(dishRepository::findById)
                .map(Dish::getName)
                .orElse("#" + recipe.getRecipeId());
    }

    private static double jaccard(Set<Integer> left, Set<Integer> right) {
        if (left == null || right == null || left.isEmpty() || right.isEmpty()) {
            return 0d;
        }
        Set<Integer> intersection = new HashSet<>(left);
        intersection.retainAll(right);
        Set<Integer> union = new HashSet<>(left);
        union.addAll(right);
        return union.isEmpty() ? 0d : (double) intersection.size() / union.size();
    }
}
