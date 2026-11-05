package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.repository.ContentRecipeDetailRepository;
import com.fpt.swp391.nutribot.repository.ContentRecipeIngredientRepository;
import com.fpt.swp391.nutribot.repository.ContentRecipeStepRepository;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.util.List;

/** Reads a community blog recipe from normalized child rows. content.body is prose only. */
@Component
public class ContentRecipeBodyParser {
    private static final String[] TITLE_PREFIXES = {"Chia sẻ cách làm ", "Video hướng dẫn ", "Góc bếp: ", "Góc bếp:", "Hướng dẫn "};
    private final ContentRecipeDetailRepository detailRepository;
    private final ContentRecipeIngredientRepository ingredientRepository;
    private final ContentRecipeStepRepository stepRepository;

    /** The sole bean constructor: Spring injects the approved relational-table repositories. */
    public ContentRecipeBodyParser(
            ContentRecipeDetailRepository detailRepository,
            ContentRecipeIngredientRepository ingredientRepository,
            ContentRecipeStepRepository stepRepository) {
        this.detailRepository = detailRepository;
        this.ingredientRepository = ingredientRepository;
        this.stepRepository = stepRepository;
    }

    public RecipeExtractionGatewayService.RecipeExtractionResult parse(Content content) {
        if (content == null || content.getContentId() == null) return null;
        String dishName = stripTitlePrefix(content.getTitle());
        if (dishName == null || dishName.isBlank()) return null;
        var detail = detailRepository.findById(content.getContentId()).orElse(null);
        var ingredients = ingredientRepository.findByContentIdOrderBySortOrderAsc(content.getContentId()).stream()
                .map(row -> new RecipeExtractionGatewayService.IngredientProposal(row.getIngredientName(), quantity(row.getQuantity()), row.getUnit(), null)).toList();
        List<String> steps = stepRepository.findByContentIdOrderByStepNumberAsc(content.getContentId()).stream()
                .map(row -> row.getInstruction()).toList();
        if (detail == null && ingredients.isEmpty() && steps.isEmpty()) return null;
        var dish = new RecipeExtractionGatewayService.DishProposal(dishName, content.getBody(), null, null);
        var nutrition = detail == null ? null : new RecipeExtractionGatewayService.NutritionProposal(
                decimalToInteger(detail.getCalories()), detail.getProteinG(), detail.getCarbsG(), detail.getFatG(), detail.getFiberG());
        var recipe = new RecipeExtractionGatewayService.RecipeProposal(dishName, content.getBody(),
                detail == null ? null : detail.getPrepMinutes(), detail == null ? null : detail.getCookMinutes(),
                detail == null ? null : detail.getServings(), steps);
        return new RecipeExtractionGatewayService.RecipeExtractionResult(dish, nutrition, ingredients, recipe);
    }

    private static BigDecimal quantity(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try { return new BigDecimal(raw.trim().replace(',', '.')); } catch (NumberFormatException ignored) { return null; }
    }
    private static Integer decimalToInteger(BigDecimal value) { return value == null ? null : value.intValue(); }
    static String stripTitlePrefix(String title) {
        if (title == null) return null;
        String result = title.trim();
        for (String prefix : TITLE_PREFIXES) if (result.regionMatches(true, 0, prefix, 0, prefix.length())) return result.substring(prefix.length()).trim();
        return result;
    }
}
