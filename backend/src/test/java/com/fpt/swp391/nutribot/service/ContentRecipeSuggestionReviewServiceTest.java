package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.request.ContentRecipeSuggestionReviewRequest;
import com.fpt.swp391.nutribot.dto.response.ContentRecipeSuggestionResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Category;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestion;
import com.fpt.swp391.nutribot.entity.Dish;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.entity.Recipe;
import com.fpt.swp391.nutribot.entity.RecipeIngredient;
import com.fpt.swp391.nutribot.entity.RecipeIngredientId;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.ConflictException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.CategoryRepository;
import com.fpt.swp391.nutribot.repository.ContentRecipeSuggestionRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.DishRepository;
import com.fpt.swp391.nutribot.repository.IngredientRepository;
import com.fpt.swp391.nutribot.repository.RecipeIngredientRepository;
import com.fpt.swp391.nutribot.repository.RecipeRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử ContentRecipeSuggestionReviewService (NB-61)")
class ContentRecipeSuggestionReviewServiceTest {

    @Mock
    private ContentRecipeSuggestionRepository suggestionRepository;
    @Mock
    private ContentRepository contentRepository;
    @Mock
    private DishRepository dishRepository;
    @Mock
    private RecipeRepository recipeRepository;
    @Mock
    private IngredientRepository ingredientRepository;
    @Mock
    private RecipeIngredientRepository recipeIngredientRepository;
    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private UserRepository userRepository;

    private ContentRecipeSuggestionReviewService service;

    @BeforeEach
    void setUp() {
        service = new ContentRecipeSuggestionReviewService(
                suggestionRepository,
                contentRepository,
                dishRepository,
                recipeRepository,
                ingredientRepository,
                recipeIngredientRepository,
                categoryRepository,
                userRepository,
                new ObjectMapper(),
                new VegetarianTypeClassifier(),
                "salad-healthy",
                "rau-cu",
                "verified");
    }

    private User admin() {
        return User.builder().userId(1).username("admin").fullName("Quản trị viên").build();
    }

    private User author() {
        return User.builder()
                .userId(9)
                .username("author")
                .fullName("Tác giả")
                .status(AccountStatus.ACTIVE)
                .build();
    }

    private Content content(int categoryId) {
        return Content.builder()
                .contentId(82)
                .user(author())
                .contentType("BLOG")
                .categoryId(categoryId)
                .title("Bún gạo lứt rau củ")
                .status("published")
                .thumbnailUrl("https://img.nutribot.test/bun-gao-lut.jpg")
                .viewCount(1800)
                .build();
    }

    private ContentRecipeSuggestion pendingSuggestion(Content content) {
        return ContentRecipeSuggestion.builder()
                .suggestionId(700)
                .content(content)
                .status("PENDING")
                .sourceViewCount(1800)
                .sourceVoteCount(120)
                .dishName("Bún gạo lứt rau củ")
                .dishDescription("Nhẹ bụng")
                .servingSize(BigDecimal.ONE)
                .servingUnit("bowl")
                .calories(418)
                .proteinG(new BigDecimal("15.8"))
                .carbsG(new BigDecimal("64.2"))
                .fatG(new BigDecimal("11.6"))
                .fiberG(new BigDecimal("9.4"))
                .ingredientsJson("[{\"name\":\"Bún gạo lứt\",\"quantity\":90,\"unit\":\"g\",\"notes\":null}]")
                .recipeTitle("Bún gạo lứt rau củ")
                .recipeDescription("Công thức")
                .prepTimeMin(12)
                .cookTimeMin(10)
                .servings(1)
                .recipeStepsJson("[\"Ngâm bún\",\"Áp chảo\"]")
                .build();
    }

    private Category category(int id, String type) {
        return Category.builder().categoryId(id).categoryType(type).active(true).build();
    }

    private ContentRecipeSuggestionReviewRequest request(String action, String reason) {
        ContentRecipeSuggestionReviewRequest request = new ContentRecipeSuggestionReviewRequest();
        request.setAction(action);
        request.setRejectionReason(reason);
        return request;
    }

    @Test
    @DisplayName("List trả về danh sách đã ánh xạ kèm reviewer và parse nguyên liệu/bước làm")
    void list_mapsSuggestions() {
        ContentRecipeSuggestion approved = pendingSuggestion(content(20));
        approved.setStatus("APPROVED");
        approved.setReviewedBy(1);

        when(suggestionRepository.findAllWithContent(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(approved)));
        when(userRepository.findAllById(anyCollection())).thenReturn(List.of(admin()));

        PagedResponse<ContentRecipeSuggestionResponse> result = service.list(null, 0, 10);

        assertEquals(1, result.getContent().size());
        ContentRecipeSuggestionResponse item = result.getContent().get(0);
        assertEquals("APPROVED", item.getStatus());
        assertEquals("Quản trị viên", item.getReviewerName());
        assertEquals("Bún gạo lứt rau củ", item.getDish().getName());
        assertEquals(1, item.getIngredients().size());
        assertEquals(2, item.getRecipe().getSteps().size());
        assertEquals(82, item.getSourceContent().getContentId());
    }

    @Test
    @DisplayName("List lọc theo status chuyển sang chữ hoa")
    void list_filteredByStatus() {
        when(suggestionRepository.findByStatus(eq("PENDING"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(pendingSuggestion(content(20)))));

        PagedResponse<ContentRecipeSuggestionResponse> result = service.list("pending", 0, 10);

        assertEquals(1, result.getContent().size());
        verify(suggestionRepository).findByStatus(eq("PENDING"), any(Pageable.class));
    }

    @Test
    @DisplayName("GetById không tìm thấy -> NotFoundException")
    void getById_notFound() {
        when(suggestionRepository.findDetailById(999)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.getById(999));
    }

    @Test
    @DisplayName("Approve hợp lệ tạo mới Dish/Recipe/Ingredients và cập nhật trạng thái APPROVED")
    void review_approve_createsCatalog() {
        Content content = content(20);
        ContentRecipeSuggestion suggestion = pendingSuggestion(content);

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));
        when(contentRepository.findPublishedById(82, "published")).thenReturn(Optional.of(content));
        when(categoryRepository.findById(20)).thenReturn(Optional.of(category(20, "RECIPE")));
        when(categoryRepository.findBySlug("rau-cu")).thenReturn(Optional.of(category(5, "INGREDIENT")));
        when(dishRepository.findByNameIgnoreCase("Bún gạo lứt rau củ")).thenReturn(Optional.empty());
        when(dishRepository.save(any(Dish.class))).thenAnswer(invocation -> {
            Dish dish = invocation.getArgument(0);
            dish.setDishId(50);
            return dish;
        });
        when(recipeRepository.findByDishId(50)).thenReturn(Optional.empty());
        when(recipeRepository.save(any(Recipe.class))).thenAnswer(invocation -> {
            Recipe recipe = invocation.getArgument(0);
            recipe.setRecipeId(60);
            return recipe;
        });
        when(ingredientRepository.findByNameIgnoreCase("Bún gạo lứt")).thenReturn(Optional.empty());
        when(ingredientRepository.save(any(Ingredient.class))).thenAnswer(invocation -> {
            Ingredient ingredient = invocation.getArgument(0);
            ingredient.setIngredientId(70);
            return ingredient;
        });
        when(recipeIngredientRepository.existsById(any(RecipeIngredientId.class))).thenReturn(false);

        ContentRecipeSuggestionResponse response = service.review(700, request("APPROVE", null), "admin");

        assertEquals("APPROVED", response.getStatus());
        assertEquals(50, response.getDishId());
        assertEquals(60, response.getRecipeId());
        assertEquals("APPROVED", suggestion.getStatus());
        assertEquals(1, suggestion.getReviewedBy());

        ArgumentCaptor<Dish> dishCaptor = ArgumentCaptor.forClass(Dish.class);
        verify(dishRepository).save(dishCaptor.capture());
        assertEquals(20, dishCaptor.getValue().getCategoryId());
        assertEquals(new BigDecimal("11.6"), dishCaptor.getValue().getHealthyFatsG());
        assertEquals("VEGAN", dishCaptor.getValue().getVegetarianType());
        assertEquals("https://img.nutribot.test/bun-gao-lut.jpg", dishCaptor.getValue().getImageUrl());

        ArgumentCaptor<Recipe> recipeCaptor = ArgumentCaptor.forClass(Recipe.class);
        verify(recipeRepository).save(recipeCaptor.capture());
        assertEquals("verified", recipeCaptor.getValue().getStatus());
        assertEquals(1, recipeCaptor.getValue().getCreatedBy());
        assertEquals("Ngâm bún\nÁp chảo", recipeCaptor.getValue().getInstructions());

        ArgumentCaptor<RecipeIngredient> riCaptor = ArgumentCaptor.forClass(RecipeIngredient.class);
        verify(recipeIngredientRepository).save(riCaptor.capture());
        assertEquals(60, riCaptor.getValue().getRecipeId());
        assertEquals(70, riCaptor.getValue().getIngredientId());
        assertEquals(new BigDecimal("90"), riCaptor.getValue().getQuantity());
        assertEquals("g", riCaptor.getValue().getUnit());
    }

    @Test
    @DisplayName("Approve liên kết Dish/Recipe đã tồn tại, không tạo trùng")
    void review_approve_linksExistingCatalog() {
        Content content = content(20);
        ContentRecipeSuggestion suggestion = pendingSuggestion(content);
        suggestion.setIngredientsJson(null);
        suggestion.setRecipeStepsJson(null);

        Dish existingDish = Dish.builder().dishId(50).name("Bún gạo lứt rau củ").build();
        Recipe existingRecipe = Recipe.builder().recipeId(60).dishId(50).build();

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));
        when(contentRepository.findPublishedById(82, "published")).thenReturn(Optional.of(content));
        when(dishRepository.findByNameIgnoreCase("Bún gạo lứt rau củ")).thenReturn(Optional.of(existingDish));
        when(recipeRepository.findByDishId(50)).thenReturn(Optional.of(existingRecipe));

        ContentRecipeSuggestionResponse response = service.review(700, request("APPROVE", null), "admin");

        assertEquals(50, response.getDishId());
        assertEquals(60, response.getRecipeId());
        verify(dishRepository, never()).save(any(Dish.class));
        verify(recipeRepository, never()).save(any(Recipe.class));
    }

    @Test
    @DisplayName("Approve nội dung nguồn đã ngừng công khai -> ConflictException, không tạo dữ liệu")
    void review_approve_staleContent_conflict() {
        ContentRecipeSuggestion suggestion = pendingSuggestion(content(20));

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));
        when(contentRepository.findPublishedById(82, "published")).thenReturn(Optional.empty());

        assertThrows(ConflictException.class,
                () -> service.review(700, request("APPROVE", null), "admin"));
        verify(dishRepository, never()).save(any(Dish.class));
        verify(recipeRepository, never()).save(any(Recipe.class));
        assertEquals("PENDING", suggestion.getStatus());
    }

    @Test
    @DisplayName("Reject cập nhật trạng thái REJECTED kèm lý do, không đụng catalog")
    void review_reject_updatesStateOnly() {
        ContentRecipeSuggestion suggestion = pendingSuggestion(content(20));

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));

        ContentRecipeSuggestionResponse response = service.review(700, request("REJECT", "Trùng món có sẵn"), "admin");

        assertEquals("REJECTED", response.getStatus());
        assertEquals("Trùng món có sẵn", response.getRejectionReason());
        assertEquals("REJECTED", suggestion.getStatus());
        assertEquals(1, suggestion.getReviewedBy());
        verifyNoInteractions(dishRepository, recipeRepository, ingredientRepository, recipeIngredientRepository);
    }

    @Test
    @DisplayName("Reject thiếu lý do -> BadRequestException")
    void review_reject_withoutReason_badRequest() {
        ContentRecipeSuggestion suggestion = pendingSuggestion(content(20));

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));

        assertThrows(BadRequestException.class,
                () -> service.review(700, request("REJECT", "   "), "admin"));
    }

    @Test
    @DisplayName("Review lại suggestion đã xử lý -> ConflictException")
    void review_alreadyReviewed_conflict() {
        ContentRecipeSuggestion suggestion = pendingSuggestion(content(20));
        suggestion.setStatus("APPROVED");

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));

        assertThrows(ConflictException.class,
                () -> service.review(700, request("APPROVE", null), "admin"));
        verifyNoInteractions(contentRepository, dishRepository, recipeRepository);
    }

    @Test
    @DisplayName("Review suggestion không tồn tại -> NotFoundException")
    void review_notFound() {
        when(suggestionRepository.findByIdForUpdate(999)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class,
                () -> service.review(999, request("APPROVE", null), "admin"));
    }

    @Test
    @DisplayName("Approve nhưng đề xuất thiếu tên món -> BadRequestException")
    void review_approve_missingDishName_badRequest() {
        Content content = content(20);
        ContentRecipeSuggestion suggestion = pendingSuggestion(content);
        suggestion.setDishName("   ");

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));
        when(contentRepository.findPublishedById(82, "published")).thenReturn(Optional.of(content));

        assertThrows(BadRequestException.class,
                () -> service.review(700, request("APPROVE", null), "admin"));
        verify(dishRepository, never()).save(any(Dish.class));
    }
}
