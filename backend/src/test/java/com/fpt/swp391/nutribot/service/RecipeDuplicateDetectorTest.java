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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử RecipeDuplicateDetector (NB-86)")
class RecipeDuplicateDetectorTest {

    @Mock
    private RecipeRepository recipeRepository;
    @Mock
    private DishRepository dishRepository;
    @Mock
    private IngredientRepository ingredientRepository;
    @Mock
    private RecipeIngredientRepository recipeIngredientRepository;

    private RecipeDuplicateDetector detector;

    @BeforeEach
    void setUp() {
        detector = new RecipeDuplicateDetector(
                recipeRepository, dishRepository, ingredientRepository, recipeIngredientRepository, 0.8d);
    }

    private ContentRecipeSuggestion suggestion() {
        return ContentRecipeSuggestion.builder()
                .suggestionId(700)
                .content(Content.builder().contentId(82).build())
                .status("PENDING")
                .dishName("Bún gạo lứt rau củ")
                .build();
    }

    private IngredientProposal ingredient(String name) {
        return new IngredientProposal(name, new BigDecimal("50"), "g", null);
    }

    @Test
    @DisplayName("Bài viết nguồn đã được nhập công thức thì bị chặn")
    void importedSourceContent_error() {
        when(recipeRepository.findFirstBySourceContentId(82))
                .thenReturn(Optional.of(Recipe.builder().recipeId(60).dishId(50).build()));
        when(dishRepository.findById(50))
                .thenReturn(Optional.of(Dish.builder().dishId(50).name("Phở nấm").build()));

        List<RecipeValidationIssue> issues = detector.detect(suggestion(), List.of(ingredient("Nấm")));

        assertEquals(1, issues.size());
        assertEquals("SOURCE_CONTENT_ALREADY_IMPORTED", issues.get(0).getCode());
        assertEquals(RecipeValidationIssue.SEVERITY_ERROR, issues.get(0).getSeverity());
        assertTrue(issues.get(0).getMessage().contains("Phở nấm"));
    }

    @Test
    @DisplayName("Tên món trùng slug với món đã có thì bị chặn")
    void duplicateDishName_error() {
        when(dishRepository.findBySlug("bun-gao-lut-rau-cu"))
                .thenReturn(Optional.of(Dish.builder().dishId(50).name("Bún gạo lứt rau củ").build()));

        List<RecipeValidationIssue> issues = detector.detect(suggestion(), List.of());

        assertEquals(1, issues.size());
        assertEquals("DUPLICATE_DISH_NAME", issues.get(0).getCode());
        assertEquals(RecipeValidationIssue.SEVERITY_ERROR, issues.get(0).getSeverity());
    }

    @Test
    @DisplayName("Tập nguyên liệu trùng >= 80% sinh cảnh báo kèm món đã có")
    void ingredientOverlap_warning() {
        ContentRecipeSuggestion suggestion = suggestion();
        List<IngredientProposal> ingredients = List.of(ingredient("Cà rốt"), ingredient("Bún gạo lứt"));

        when(ingredientRepository.findByNameIgnoreCase("Cà rốt"))
                .thenReturn(Optional.of(Ingredient.builder().ingredientId(1).name("Cà rốt").build()));
        when(ingredientRepository.findByNameIgnoreCase("Bún gạo lứt"))
                .thenReturn(Optional.of(Ingredient.builder().ingredientId(2).name("Bún gạo lứt").build()));
        when(recipeIngredientRepository.findRecipeIdsByIngredientIdIn(anyCollection()))
                .thenReturn(List.of(60));
        when(recipeIngredientRepository.findAllByRecipeIdIn(anyCollection()))
                .thenReturn(List.of(
                        RecipeIngredient.builder().recipeId(60).ingredientId(1).quantity(BigDecimal.ONE).unit("g").build(),
                        RecipeIngredient.builder().recipeId(60).ingredientId(2).quantity(BigDecimal.ONE).unit("g").build()));
        when(recipeRepository.findById(60))
                .thenReturn(Optional.of(Recipe.builder().recipeId(60).dishId(50).build()));
        when(dishRepository.findById(50))
                .thenReturn(Optional.of(Dish.builder().dishId(50).name("Bún gạo lứt rau củ").build()));

        List<RecipeValidationIssue> issues = detector.detect(suggestion, ingredients);

        assertEquals(1, issues.size());
        assertEquals("POSSIBLE_DUPLICATE_RECIPE", issues.get(0).getCode());
        assertEquals(RecipeValidationIssue.SEVERITY_WARNING, issues.get(0).getSeverity());
        assertTrue(issues.get(0).getMessage().contains("100%"));
        assertTrue(issues.get(0).getMessage().contains("Bún gạo lứt rau củ"));
    }

    @Test
    @DisplayName("Trùng dưới ngưỡng thì không sinh cảnh báo")
    void ingredientOverlapBelowThreshold_noWarning() {
        ContentRecipeSuggestion suggestion = suggestion();
        List<IngredientProposal> ingredients = List.of(ingredient("Cà rốt"), ingredient("Bún gạo lứt"));

        when(ingredientRepository.findByNameIgnoreCase("Cà rốt"))
                .thenReturn(Optional.of(Ingredient.builder().ingredientId(1).name("Cà rốt").build()));
        when(ingredientRepository.findByNameIgnoreCase("Bún gạo lứt"))
                .thenReturn(Optional.of(Ingredient.builder().ingredientId(2).name("Bún gạo lứt").build()));
        when(recipeIngredientRepository.findRecipeIdsByIngredientIdIn(anyCollection()))
                .thenReturn(List.of(60));
        when(recipeIngredientRepository.findAllByRecipeIdIn(anyCollection()))
                .thenReturn(List.of(
                        RecipeIngredient.builder().recipeId(60).ingredientId(1).quantity(BigDecimal.ONE).unit("g").build(),
                        RecipeIngredient.builder().recipeId(60).ingredientId(3).quantity(BigDecimal.ONE).unit("g").build(),
                        RecipeIngredient.builder().recipeId(60).ingredientId(4).quantity(BigDecimal.ONE).unit("g").build(),
                        RecipeIngredient.builder().recipeId(60).ingredientId(5).quantity(BigDecimal.ONE).unit("g").build()));

        List<RecipeValidationIssue> issues = detector.detect(suggestion, ingredients);

        assertTrue(issues.isEmpty());
    }

    @Test
    @DisplayName("Dưới 2 nguyên liệu đã có trong catalog thì không truy vấn trùng nguyên liệu")
    void fewerThanTwoKnownIngredients_skipsQuery() {
        when(ingredientRepository.findByNameIgnoreCase("Cà rốt"))
                .thenReturn(Optional.of(Ingredient.builder().ingredientId(1).name("Cà rốt").build()));
        when(ingredientRepository.findByNameIgnoreCase("Nguyên liệu mới"))
                .thenReturn(Optional.empty());

        List<RecipeValidationIssue> issues = detector.detect(
                suggestion(), List.of(ingredient("Cà rốt"), ingredient("Nguyên liệu mới")));

        assertTrue(issues.isEmpty());
        verifyNoInteractions(recipeIngredientRepository);
    }

    @Test
    @DisplayName("Đề xuất không gắn nội dung nguồn thì bỏ qua kiểm tra nguồn")
    void nullContent_skipsSourceCheck() {
        ContentRecipeSuggestion suggestion = suggestion();
        suggestion.setContent(null);

        List<RecipeValidationIssue> issues = detector.detect(suggestion, List.of());

        assertTrue(issues.isEmpty());
        verify(recipeRepository, never()).findFirstBySourceContentId(any());
    }
}
