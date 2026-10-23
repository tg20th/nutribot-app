package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.request.ContentRecipeSuggestionReviewRequest;
import com.fpt.swp391.nutribot.dto.response.ContentRecipeSuggestionResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.dto.response.RecipeSuggestionValidation;
import com.fpt.swp391.nutribot.dto.response.RecipeValidationIssue;
import com.fpt.swp391.nutribot.dto.response.ResolvedRecipeIngredient;
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
import com.fpt.swp391.nutribot.exception.RecipeValidationException;
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
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
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
    @Mock
    private ApplicationEventPublisher eventPublisher;
    @Mock
    private RecipeSuggestionAuditService auditService;
    @Mock
    private RecipeSuggestionValidator validator;

    private final RecipeSuggestionPayloadReader payloadReader =
            new RecipeSuggestionPayloadReader(new ObjectMapper());

    private ContentRecipeSuggestionReviewService service;

    @BeforeEach
    void setUp() {
        service = new ContentRecipeSuggestionReviewService(
                suggestionRepository,
                contentRepository,
                dishRepository,
                recipeRepository,
                recipeIngredientRepository,
                categoryRepository,
                userRepository,
                payloadReader,
                validator,
                "salad-healthy",
                "verified",
                eventPublisher,
                auditService);
        lenient().when(validator.validate(any())).thenReturn(validValidation());
        lenient().when(validator.validate(any(), any())).thenReturn(validValidation());
    }

    private RecipeSuggestionValidation validValidation() {
        return RecipeSuggestionValidation.builder()
                .valid(true)
                .canApprove(true)
                .vegetarianType("VEGAN")
                .vegetarianVerdict("VEGETARIAN")
                .issues(List.of())
                .ingredientResolutions(List.of(ResolvedRecipeIngredient.builder()
                        .proposalIndex(0).proposedName("Bún gạo lứt").ingredientId(70)
                        .ingredientName("Bún gạo lứt").status("MATCHED").build()))
                .build();
    }

    private RecipeSuggestionValidation invalidValidation(String field, String code, String message) {
        return RecipeSuggestionValidation.builder()
                .valid(false)
                .canApprove(false)
                .issues(List.of(RecipeValidationIssue.builder()
                        .field(field)
                        .code(code)
                        .severity(RecipeValidationIssue.SEVERITY_ERROR)
                        .message(message)
                        .build()))
                .build();
    }

    private void stubCatalogCreation() {
        when(categoryRepository.findById(20)).thenReturn(Optional.of(category(20, "RECIPE")));
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
        when(recipeIngredientRepository.findAllByRecipeId(60)).thenReturn(List.of(
                RecipeIngredient.builder()
                        .recipeId(60)
                        .ingredientId(70)
                        .quantity(BigDecimal.ONE)
                        .unit("old")
                        .notes("old note")
                        .build()));
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
                .recipeConsent(true)
                .recipeConsentAt(java.time.LocalDateTime.of(2026, 10, 10, 8, 0))
                .recipeConsentTermsVersion(RecipeConsentPolicy.CURRENT_TERMS_VERSION)
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
                .ingredientsJson("[{\"name\":\"Bún gạo lứt\",\"quantity\":90,\"unit\":\"g\",\"notes\":\"Ngâm trước\"}]")
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
    @DisplayName("NB-92: Approve liên kết ingredient catalog hiện có, không tự tạo nguyên liệu")
    void review_approve_createsCatalog() {
        Content content = content(20);
        ContentRecipeSuggestion suggestion = pendingSuggestion(content);

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));
        when(contentRepository.findByContentIdAndStatus(82, "published")).thenReturn(Optional.of(content));
        stubCatalogCreation();

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
        // NB-80: Recipe import từ cộng đồng phải ghi nguồn gốc tác giả
        assertEquals(9, recipeCaptor.getValue().getSourceUserId());
        assertEquals(82, recipeCaptor.getValue().getSourceContentId());

        ArgumentCaptor<RecipeIngredient> riCaptor = ArgumentCaptor.forClass(RecipeIngredient.class);
        verify(recipeIngredientRepository).save(riCaptor.capture());
        assertEquals(60, riCaptor.getValue().getRecipeId());
        assertEquals(70, riCaptor.getValue().getIngredientId());
        assertEquals(new BigDecimal("90"), riCaptor.getValue().getQuantity());
        assertEquals("g", riCaptor.getValue().getUnit());
        assertEquals("Ngâm trước", riCaptor.getValue().getNotes());
        verify(ingredientRepository, never()).save(any(Ingredient.class));
        // NB-87: Duyệt đề xuất không được sửa nội dung gốc của tác giả
        verify(contentRepository, never()).save(any(Content.class));
    }

    @Test
    @DisplayName("NB-86: Approve bị chặn khi validator phát hiện món đã tồn tại, không tạo dữ liệu")
    void review_approve_duplicateDish_blocked() {
        Content content = content(20);
        ContentRecipeSuggestion suggestion = pendingSuggestion(content);

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));
        when(contentRepository.findByContentIdAndStatus(82, "published")).thenReturn(Optional.of(content));
        when(validator.validate(any(), any())).thenReturn(invalidValidation(
                "dish.name", "DUPLICATE_DISH_NAME", "Món đã tồn tại trong hệ thống"));

        assertThrows(RecipeValidationException.class,
                () -> service.review(700, request("APPROVE", null), "admin"));
        verify(dishRepository, never()).save(any(Dish.class));
        verify(recipeRepository, never()).save(any(Recipe.class));
        assertEquals("PENDING", suggestion.getStatus());
    }

    @Test
    @DisplayName("Approve nội dung có tác giả bị cảnh cáo (WARN) vẫn duyệt được vì chỉ xét trạng thái published")
    void review_approve_warnedAuthor_stillApproved() {
        Content content = content(20);
        content.getUser().setStatus(AccountStatus.WARN);
        ContentRecipeSuggestion suggestion = pendingSuggestion(content);

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));
        when(contentRepository.findByContentIdAndStatus(82, "published")).thenReturn(Optional.of(content));
        stubCatalogCreation();

        ContentRecipeSuggestionResponse response = service.review(700, request("APPROVE", null), "admin");

        assertEquals("APPROVED", response.getStatus());
        assertEquals(50, response.getDishId());
        assertEquals(60, response.getRecipeId());
        assertEquals("APPROVED", suggestion.getStatus());
        verify(contentRepository, never()).findPublishedById(anyInt(), anyString());
    }

    @Test
    @DisplayName("Approve nội dung nguồn đã ngừng công khai -> ConflictException, không tạo dữ liệu")
    void review_approve_staleContent_conflict() {
        ContentRecipeSuggestion suggestion = pendingSuggestion(content(20));

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));
        when(contentRepository.findByContentIdAndStatus(82, "published")).thenReturn(Optional.empty());

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
    @DisplayName("NB-87: Duyệt lại đề xuất đã APPROVED là idempotent, không tạo thêm dữ liệu")
    void review_approveTwice_idempotent() {
        ContentRecipeSuggestion suggestion = pendingSuggestion(content(20));
        suggestion.setStatus("APPROVED");
        suggestion.setDishId(50);
        suggestion.setRecipeId(60);
        suggestion.setReviewedBy(1);
        suggestion.setReviewedAt(java.time.LocalDateTime.of(2026, 10, 12, 9, 0));

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findAllById(anyCollection())).thenReturn(List.of(admin()));

        ContentRecipeSuggestionResponse response = service.review(700, request("APPROVE", null), "admin");

        assertEquals("APPROVED", response.getStatus());
        assertEquals(50, response.getDishId());
        assertEquals(60, response.getRecipeId());
        verify(suggestionRepository, never()).save(any(ContentRecipeSuggestion.class));
        verifyNoInteractions(contentRepository, dishRepository, recipeRepository,
                ingredientRepository, recipeIngredientRepository, auditService, eventPublisher);
    }

    @Test
    @DisplayName("NB-87: Duyệt đề xuất đã bị từ chối -> ConflictException")
    void review_approveAfterReject_conflict() {
        ContentRecipeSuggestion suggestion = pendingSuggestion(content(20));
        suggestion.setStatus("REJECTED");

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));

        assertThrows(ConflictException.class,
                () -> service.review(700, request("APPROVE", null), "admin"));
        verifyNoInteractions(contentRepository, dishRepository, recipeRepository);
    }

    @Test
    @DisplayName("NB-87: Từ chối đề xuất đã duyệt -> ConflictException")
    void review_rejectAfterApprove_conflict() {
        ContentRecipeSuggestion suggestion = pendingSuggestion(content(20));
        suggestion.setStatus("APPROVED");

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));

        assertThrows(ConflictException.class,
                () -> service.review(700, request("REJECT", "Đổi ý"), "admin"));
    }

    @Test
    @DisplayName("NB-87: Tác giả đồng thuận theo điều khoản cũ -> ConflictException, không tạo dữ liệu")
    void review_approve_outdatedConsentTerms_conflict() {
        Content content = content(20);
        content.setRecipeConsentTermsVersion("v0");
        ContentRecipeSuggestion suggestion = pendingSuggestion(content);

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));
        when(contentRepository.findByContentIdAndStatus(82, "published")).thenReturn(Optional.of(content));

        assertThrows(ConflictException.class,
                () -> service.review(700, request("APPROVE", null), "admin"));
        verify(dishRepository, never()).save(any(Dish.class));
        verify(recipeRepository, never()).save(any(Recipe.class));
        assertEquals("PENDING", suggestion.getStatus());
    }

    @Test
    @DisplayName("NB-87: Đồng thuận thiếu mốc thời gian -> BadRequestException, không tạo dữ liệu")
    void review_approve_missingConsentAt_badRequest() {
        Content content = content(20);
        content.setRecipeConsentAt(null);
        ContentRecipeSuggestion suggestion = pendingSuggestion(content);

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));
        when(contentRepository.findByContentIdAndStatus(82, "published")).thenReturn(Optional.of(content));

        assertThrows(BadRequestException.class,
                () -> service.review(700, request("APPROVE", null), "admin"));
        verify(dishRepository, never()).save(any(Dish.class));
        assertEquals("PENDING", suggestion.getStatus());
    }

    @Test
    @DisplayName("NB-87: Đụng unique tên món/nguyên liệu khi duyệt song song -> ConflictException thay vì 500")
    void review_approve_catalogRace_conflict() {
        Content content = content(20);
        ContentRecipeSuggestion suggestion = pendingSuggestion(content);

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));
        when(contentRepository.findByContentIdAndStatus(82, "published")).thenReturn(Optional.of(content));
        when(categoryRepository.findById(20)).thenReturn(Optional.of(category(20, "RECIPE")));
        when(dishRepository.save(any(Dish.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate dish"));

        assertThrows(ConflictException.class,
                () -> service.review(700, request("APPROVE", null), "admin"));
        verify(recipeRepository, never()).save(any(Recipe.class));
        assertEquals("PENDING", suggestion.getStatus());
    }

    @Test
    @DisplayName("Review suggestion không tồn tại -> NotFoundException")
    void review_notFound() {
        when(suggestionRepository.findByIdForUpdate(999)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class,
                () -> service.review(999, request("APPROVE", null), "admin"));
    }

    @Test
    @DisplayName("NB-86: Approve nhưng dữ liệu chưa hợp lệ -> RecipeValidationException, không tạo dữ liệu")
    void review_approve_invalidPayload_blocked() {
        Content content = content(20);
        ContentRecipeSuggestion suggestion = pendingSuggestion(content);
        suggestion.setDishName("   ");

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));
        when(contentRepository.findByContentIdAndStatus(82, "published")).thenReturn(Optional.of(content));
        when(validator.validate(any(), any())).thenReturn(invalidValidation(
                "dish.name", "DISH_NAME_REQUIRED", "Đề xuất thiếu tên món ăn"));

        assertThrows(RecipeValidationException.class,
                () -> service.review(700, request("APPROVE", null), "admin"));
        verify(dishRepository, never()).save(any(Dish.class));
        verify(recipeRepository, never()).save(any(Recipe.class));
        assertEquals("PENDING", suggestion.getStatus());
    }

    @Test
    @DisplayName("NB-80: Approve bị chặn khi tác giả đã gỡ đồng thuận dùng công thức")
    void review_approve_consentRevoked_badRequest() {
        Content content = content(20);
        content.setRecipeConsent(false);
        content.setRecipeConsentAt(null);
        content.setRecipeConsentTermsVersion(null);
        ContentRecipeSuggestion suggestion = pendingSuggestion(content);

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));
        when(contentRepository.findByContentIdAndStatus(82, "published")).thenReturn(Optional.of(content));

        assertThrows(BadRequestException.class,
                () -> service.review(700, request("APPROVE", null), "admin"));
        verify(dishRepository, never()).save(any(Dish.class));
        verify(recipeRepository, never()).save(any(Recipe.class));
        assertEquals("PENDING", suggestion.getStatus());
    }

    @Test
    @DisplayName("NB-80: Response chứa trạng thái đồng thuận của nội dung nguồn")
    void list_includesConsentInfo() {
        Content content = content(20);
        content.setRecipeConsentAt(java.time.LocalDateTime.of(2026, 10, 10, 8, 0));
        content.setRecipeConsentTermsVersion("v1");
        ContentRecipeSuggestion approved = pendingSuggestion(content);
        approved.setStatus("APPROVED");
        approved.setReviewedBy(1);

        when(suggestionRepository.findAllWithContent(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(approved)));
        when(userRepository.findAllById(anyCollection())).thenReturn(List.of(admin()));

        PagedResponse<ContentRecipeSuggestionResponse> result = service.list(null, 0, 10);

        ContentRecipeSuggestionResponse.SourceContent source = result.getContent().get(0).getSourceContent();
        assertEquals(Boolean.TRUE, source.getRecipeConsent());
        assertEquals("v1", source.getRecipeConsentTermsVersion());
        assertNotNull(source.getRecipeConsentAt());
    }

    @Test
    @DisplayName("NB-86: Chi tiết đề xuất PENDING trả kèm khối validation để Admin biết lỗi trước khi duyệt")
    void getById_pending_includesValidation() {
        ContentRecipeSuggestion suggestion = pendingSuggestion(content(20));

        when(suggestionRepository.findDetailById(700)).thenReturn(Optional.of(suggestion));
        when(validator.validate(suggestion)).thenReturn(invalidValidation(
                "ingredients", "INGREDIENTS_REQUIRED", "Đề xuất công thức phải có ít nhất một nguyên liệu"));

        ContentRecipeSuggestionResponse response = service.getById(700);

        assertNotNull(response.getValidation());
        assertFalse(response.getValidation().isValid());
        assertFalse(response.getValidation().isCanApprove());
        assertEquals("INGREDIENTS_REQUIRED",
                response.getValidation().getIssues().get(0).getCode());
    }

    @Test
    @DisplayName("NB-86: Loại ăn chay do validator quyết định được ghi vào Dish")
    void review_approve_usesValidatedVegetarianType() {
        Content content = content(20);
        ContentRecipeSuggestion suggestion = pendingSuggestion(content);

        when(suggestionRepository.findByIdForUpdate(700)).thenReturn(Optional.of(suggestion));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin()));
        when(contentRepository.findByContentIdAndStatus(82, "published")).thenReturn(Optional.of(content));
        when(validator.validate(any(), any())).thenReturn(RecipeSuggestionValidation.builder()
                .valid(true)
                .canApprove(true)
                .vegetarianType("LACTO_OVO")
                .vegetarianVerdict("VEGETARIAN")
                .issues(List.of())
                .ingredientResolutions(List.of(ResolvedRecipeIngredient.builder()
                        .proposalIndex(0).proposedName("Bún gạo lứt").ingredientId(70)
                        .ingredientName("Bún gạo lứt").status("MATCHED").build()))
                .build());
        stubCatalogCreation();

        service.review(700, request("APPROVE", null), "admin");

        ArgumentCaptor<Dish> dishCaptor = ArgumentCaptor.forClass(Dish.class);
        verify(dishRepository).save(dishCaptor.capture());
        assertEquals("LACTO_OVO", dishCaptor.getValue().getVegetarianType());
    }

    @Test
    @DisplayName("NB-86: Danh sách không tính validation để tránh N+1 khi phân trang")
    void list_doesNotComputeValidation() {
        ContentRecipeSuggestion suggestion = pendingSuggestion(content(20));

        when(suggestionRepository.findAllWithContent(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(suggestion)));

        ContentRecipeSuggestionResponse item = service.list(null, 0, 10).getContent().get(0);

        assertNull(item.getValidation());
        verify(validator, never()).validate(any());
    }
}
