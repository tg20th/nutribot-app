package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.ContentRecipeSuggestionReviewRequest;
import com.fpt.swp391.nutribot.dto.response.ContentRecipeSuggestionResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.dto.response.RecipeSuggestionValidation;
import com.fpt.swp391.nutribot.entity.Category;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestion;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestionAudit;
import com.fpt.swp391.nutribot.entity.Dish;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.entity.Recipe;
import com.fpt.swp391.nutribot.entity.RecipeIngredient;
import com.fpt.swp391.nutribot.entity.RecipeIngredientId;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.event.RecipeSuggestionReviewedEvent;
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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * NB-61: Admin xem, duyệt hoặc từ chối các đề xuất món ăn sinh ra từ nội dung
 * Blog/Video giá trị cao. Khi duyệt phải revalidate nội dung nguồn và nhập dữ
 * liệu món ăn/công thức/nguyên liệu vào canonical catalog một cách an toàn
 * (transaction all-or-nothing, có khóa chống hai Admin xử lý trùng).
 */
@Service
public class ContentRecipeSuggestionReviewService {

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_APPROVED = "APPROVED";
    private static final String STATUS_REJECTED = "REJECTED";
    private static final String ACTION_APPROVE = "APPROVE";
    private static final String ACTION_REJECT = "REJECT";
    private static final String PUBLISHED_STATUS = "published";
    private static final String DISH_CATEGORY_TYPE = "RECIPE";
    private static final String INGREDIENT_CATEGORY_TYPE = "INGREDIENT";
    private static final int MAX_PAGE_SIZE = 50;

    private final ContentRecipeSuggestionRepository suggestionRepository;
    private final ContentRepository contentRepository;
    private final DishRepository dishRepository;
    private final RecipeRepository recipeRepository;
    private final IngredientRepository ingredientRepository;
    private final RecipeIngredientRepository recipeIngredientRepository;
    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final RecipeSuggestionPayloadReader payloadReader;
    private final RecipeSuggestionValidator validator;
    private final String dishDefaultCategorySlug;
    private final String ingredientDefaultCategorySlug;
    private final String recipeStatus;
    private final ApplicationEventPublisher eventPublisher;
    private final RecipeSuggestionAuditService auditService;

    public ContentRecipeSuggestionReviewService(
            ContentRecipeSuggestionRepository suggestionRepository,
            ContentRepository contentRepository,
            DishRepository dishRepository,
            RecipeRepository recipeRepository,
            IngredientRepository ingredientRepository,
            RecipeIngredientRepository recipeIngredientRepository,
            CategoryRepository categoryRepository,
            UserRepository userRepository,
            RecipeSuggestionPayloadReader payloadReader,
            RecipeSuggestionValidator validator,
            @Value("${app.content-recipe-suggestion.dish-default-category-slug:salad-healthy}") String dishDefaultCategorySlug,
            @Value("${app.content-recipe-suggestion.ingredient-default-category-slug:rau-cu}") String ingredientDefaultCategorySlug,
            @Value("${app.content-recipe-suggestion.recipe-status:verified}") String recipeStatus,
            ApplicationEventPublisher eventPublisher,
            RecipeSuggestionAuditService auditService) {
        this.suggestionRepository = suggestionRepository;
        this.contentRepository = contentRepository;
        this.dishRepository = dishRepository;
        this.recipeRepository = recipeRepository;
        this.ingredientRepository = ingredientRepository;
        this.recipeIngredientRepository = recipeIngredientRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
        this.payloadReader = payloadReader;
        this.validator = validator;
        this.dishDefaultCategorySlug = dishDefaultCategorySlug;
        this.ingredientDefaultCategorySlug = ingredientDefaultCategorySlug;
        this.recipeStatus = recipeStatus;
        this.eventPublisher = eventPublisher;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PagedResponse<ContentRecipeSuggestionResponse> list(String status, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<ContentRecipeSuggestion> result;
        if (status == null || status.isBlank()) {
            result = suggestionRepository.findAllWithContent(pageable);
        } else {
            result = suggestionRepository.findByStatus(status.trim().toUpperCase(), pageable);
        }

        Map<Integer, String> reviewerNames = resolveReviewerNames(result.getContent());
        return PagedResponse.of(result.map(s -> toResponse(s, reviewerNames)));
    }

    @Transactional(readOnly = true)
    public ContentRecipeSuggestionResponse getById(Integer suggestionId) {
        ContentRecipeSuggestion suggestion = suggestionRepository.findDetailById(suggestionId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy đề xuất với ID: " + suggestionId));
        return toResponse(suggestion, resolveReviewerNames(List.of(suggestion)),
                STATUS_PENDING.equalsIgnoreCase(suggestion.getStatus()));
    }

    @Transactional
    public ContentRecipeSuggestionResponse review(
            Integer suggestionId,
            ContentRecipeSuggestionReviewRequest request,
            String adminUsername) {
        ContentRecipeSuggestion suggestion = suggestionRepository.findByIdForUpdate(suggestionId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy đề xuất với ID: " + suggestionId));

        String action = request.getAction() == null ? "" : request.getAction().trim().toUpperCase();
        if (!ACTION_APPROVE.equals(action) && !ACTION_REJECT.equals(action)) {
            throw new BadRequestException("Action không hợp lệ: " + request.getAction());
        }

        if (!STATUS_PENDING.equalsIgnoreCase(suggestion.getStatus())) {
            // NB-87: Duyệt lại một đề xuất đã APPROVED là thao tác idempotent, không tạo thêm dữ liệu
            if (ACTION_APPROVE.equals(action) && STATUS_APPROVED.equalsIgnoreCase(suggestion.getStatus())) {
                return toResponse(suggestion, resolveReviewerNames(List.of(suggestion)));
            }
            throw new ConflictException("Đề xuất đã được xử lý với trạng thái: " + suggestion.getStatus());
        }

        User admin = resolveAdmin(adminUsername);
        try {
            if (ACTION_APPROVE.equals(action)) {
                approve(suggestion, admin);
            } else {
                reject(suggestion, request.getRejectionReason(), admin);
            }
        } catch (DataIntegrityViolationException ex) {
            // NB-87: Hai admin duyệt cùng lúc có thể đụng unique tên món/nguyên liệu -> trả 409 thay vì 500
            throw new ConflictException(
                    "Dữ liệu món hoặc nguyên liệu vừa được cập nhật bởi người khác, vui lòng tải lại và thử duyệt lại");
        }

        suggestionRepository.save(suggestion);
        recordAudit(suggestion, admin, action);
        publishReviewNotification(suggestion, admin, action);
        return toResponse(suggestion, Map.of(admin.getUserId(), displayName(admin)));
    }

    /**
     * NB-84: Ghi nhat ky vong doi trang thai de xuat (duyet / tu choi).
     */
    private void recordAudit(ContentRecipeSuggestion suggestion, User admin, String action) {
        String auditAction = ACTION_REJECT.equalsIgnoreCase(action)
                ? ContentRecipeSuggestionAudit.ACTION_REJECTED
                : ContentRecipeSuggestionAudit.ACTION_APPROVED;
        auditService.record(suggestion, auditAction,
                admin != null ? admin.getUserId() : null,
                suggestion.getRejectionReason());
    }

    private void publishReviewNotification(ContentRecipeSuggestion suggestion, User admin, String action) {
        if (suggestion == null || admin == null) {
            return;
        }
        Content content = suggestion.getContent();
        Integer authorId = content != null && content.getUser() != null ? content.getUser().getUserId() : null;
        Integer contentId = content != null ? content.getContentId() : null;
        if (authorId == null || suggestion.getSuggestionId() == null) {
            return;
        }
        eventPublisher.publishEvent(new RecipeSuggestionReviewedEvent(
                suggestion.getSuggestionId(),
                contentId,
                authorId,
                admin.getUserId(),
                action,
                suggestion.getDishName(),
                content != null ? content.getTitle() : null,
                suggestion.getRejectionReason()));
    }

    private void reject(ContentRecipeSuggestion suggestion, String reason, User admin) {
        String trimmed = reason == null ? null : reason.trim();
        if (trimmed == null || trimmed.isEmpty()) {
            throw new BadRequestException("Lý do từ chối không được để trống");
        }
        suggestion.setStatus(STATUS_REJECTED);
        suggestion.setRejectionReason(trimmed);
        suggestion.setReviewedBy(admin.getUserId());
        suggestion.setReviewedAt(LocalDateTime.now());
    }

    private void approve(ContentRecipeSuggestion suggestion, User admin) {
        Content content = suggestion.getContent();
        if (content == null || content.getContentId() == null) {
            throw new ConflictException("Đề xuất không gắn với nội dung nguồn hợp lệ");
        }

        Content freshContent = contentRepository.findByContentIdAndStatus(content.getContentId(), PUBLISHED_STATUS)
                .orElseThrow(() -> new ConflictException(
                        "Nội dung nguồn không còn công khai, không thể duyệt đề xuất"));

        // NB-87: Đồng thuận chỉ hợp lệ khi tác giả đã bật, có mốc thời gian và đúng phiên bản điều khoản hiện hành
        if (!Boolean.TRUE.equals(freshContent.getRecipeConsent())
                || freshContent.getRecipeConsentAt() == null) {
            throw new BadRequestException(
                    "Tác giả chưa đồng thuận hợp lệ cho phép dùng công thức của bài viết này");
        }
        String consentTermsVersion = freshContent.getRecipeConsentTermsVersion();
        if (!RecipeConsentPolicy.CURRENT_TERMS_VERSION.equals(consentTermsVersion)) {
            throw new ConflictException("Tác giả đã đồng thuận theo phiên bản điều khoản cũ ("
                    + (consentTermsVersion == null ? "không xác định" : consentTermsVersion)
                    + "), cần đồng thuận lại theo phiên bản "
                    + RecipeConsentPolicy.CURRENT_TERMS_VERSION + " trước khi duyệt");
        }

        RecipeSuggestionValidation validation = validator.validate(suggestion);
        if (!validation.isValid()) {
            throw new RecipeValidationException(validation.getIssues());
        }

        Dish dish = resolveOrCreateDish(suggestion, freshContent, validation.getVegetarianType());
        Recipe recipe = resolveOrCreateRecipe(suggestion, dish, admin, freshContent);
        persistIngredients(suggestion, recipe);

        suggestion.setDishId(dish.getDishId());
        suggestion.setRecipeId(recipe.getRecipeId());
        suggestion.setStatus(STATUS_APPROVED);
        suggestion.setRejectionReason(null);
        suggestion.setReviewedBy(admin.getUserId());
        suggestion.setReviewedAt(LocalDateTime.now());
    }

    private Dish resolveOrCreateDish(
            ContentRecipeSuggestion suggestion,
            Content content,
            String vegetarianType) {
        String dishName = suggestion.getDishName() == null ? null : suggestion.getDishName().trim();
        if (dishName == null || dishName.isEmpty()) {
            throw new BadRequestException("Đề xuất thiếu tên món ăn, không thể duyệt");
        }

        return dishRepository.save(Dish.builder()
                .name(dishName)
                .slug(uniqueSlug(dishName, "dish", dishRepository::existsBySlug))
                .description(suggestion.getDishDescription())
                .categoryId(resolveDishCategoryId(content))
                .imageUrl(content.getThumbnailUrl())
                .vegetarianType(vegetarianType)
                .calories(suggestion.getCalories())
                .proteinG(suggestion.getProteinG())
                .carbsG(suggestion.getCarbsG())
                .healthyFatsG(suggestion.getFatG())
                .servingSize(suggestion.getServingSize())
                .servingUnit(suggestion.getServingUnit())
                .active(true)
                .build());
    }


    private Recipe resolveOrCreateRecipe(ContentRecipeSuggestion suggestion, Dish dish, User admin, Content content) {
        return recipeRepository.findByDishId(dish.getDishId()).orElseGet(() -> {
            String title = suggestion.getRecipeTitle() == null || suggestion.getRecipeTitle().isBlank()
                    ? dish.getName()
                    : suggestion.getRecipeTitle().trim();
            return recipeRepository.save(Recipe.builder()
                    .dishId(dish.getDishId())
                    .title(title)
                    .slug(uniqueSlug(title, "recipe", recipeRepository::existsBySlug))
                    .description(suggestion.getRecipeDescription())
                    .instructions(joinSteps(suggestion.getRecipeStepsJson()))
                    .prepTimeMin(suggestion.getPrepTimeMin())
                    .cookTimeMin(suggestion.getCookTimeMin())
                    .servings(suggestion.getServings())
                    .createdBy(admin.getUserId())
                    // NB-80: Ghi nguồn gốc tác giả community để hiển thị attribution
                    .sourceUserId(content.getUser() != null ? content.getUser().getUserId() : null)
                    .sourceContentId(content.getContentId())
                    .sourceType("USER_CONTRIBUTED")
                    .contributorNameSnapshot(content.getUser() == null ? null : displayName(content.getUser()))
                    .sourcePostTitleSnapshot(content.getTitle())
                    .approvedBy(admin.getUserId())
                    .approvedAt(java.time.LocalDateTime.now())
                    .status(recipeStatus)
                    .build());
        });
    }

    private void persistIngredients(ContentRecipeSuggestion suggestion, Recipe recipe) {
        for (RecipeExtractionGatewayService.IngredientProposal proposal
                : payloadReader.readIngredients(suggestion.getIngredientsJson()).value()) {
            if (proposal == null || proposal.name() == null || proposal.name().isBlank()) {
                continue;
            }
            Ingredient ingredient = resolveOrCreateIngredient(proposal.name());
            RecipeIngredientId id = new RecipeIngredientId(recipe.getRecipeId(), ingredient.getIngredientId());
            if (recipeIngredientRepository.existsById(id)) {
                continue;
            }
            BigDecimal quantity = proposal.quantity();
            String unit = proposal.unit() == null ? null : proposal.unit().trim();
            if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0 || unit == null || unit.isEmpty()) {
                throw new IllegalStateException(
                        "Nguyên liệu chưa được kiểm tra hợp lệ trước khi nhập: " + proposal.name());
            }
            recipeIngredientRepository.save(RecipeIngredient.builder()
                    .recipeId(recipe.getRecipeId())
                    .ingredientId(ingredient.getIngredientId())
                    .quantity(quantity)
                    .unit(unit)
                    .notes(proposal.notes())
                    .build());
        }
    }

    private Ingredient resolveOrCreateIngredient(String rawName) {
        String name = rawName.trim();
        return ingredientRepository.findByNameIgnoreCase(name).orElseGet(() -> ingredientRepository.save(Ingredient.builder()
                .name(name)
                .slug(uniqueSlug(name, "ingredient", ingredientRepository::existsBySlug))
                .categoryId(resolveDefaultCategoryId(ingredientDefaultCategorySlug, INGREDIENT_CATEGORY_TYPE))
                .active(true)
                .build()));
    }

    private Integer resolveDishCategoryId(Content content) {
        Integer contentCategoryId = content.getCategoryId();
        if (contentCategoryId != null) {
            Category category = categoryRepository.findById(contentCategoryId).orElse(null);
            if (category != null
                    && Boolean.TRUE.equals(category.getActive())
                    && category.getCategoryType() != null
                    && DISH_CATEGORY_TYPE.equalsIgnoreCase(category.getCategoryType())) {
                return contentCategoryId;
            }
        }
        return resolveDefaultCategoryId(dishDefaultCategorySlug, DISH_CATEGORY_TYPE);
    }

    private Integer resolveDefaultCategoryId(String slug, String type) {
        if (slug != null && !slug.isBlank()) {
            Category bySlug = categoryRepository.findBySlug(slug.trim()).orElse(null);
            if (bySlug != null && bySlug.getCategoryType() != null
                    && type.equalsIgnoreCase(bySlug.getCategoryType())
                    && Boolean.TRUE.equals(bySlug.getActive())) {
                return bySlug.getCategoryId();
            }
        }
        List<Category> categories = categoryRepository.findActiveCategories(type);
        if (categories.isEmpty()) {
            throw new BadRequestException("Không tìm thấy danh mục " + type + " để gán cho dữ liệu món ăn mới");
        }
        return categories.get(0).getCategoryId();
    }

    private User resolveAdmin(String username) {
        if (username == null || username.isBlank()) {
            throw new BadRequestException("Không xác định được người duyệt đề xuất");
        }
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tài khoản quản trị: " + username));
    }

    private String joinSteps(String stepsJson) {
        List<String> steps = payloadReader.readSteps(stepsJson).value();
        if (steps.isEmpty()) {
            return null;
        }
        return steps.stream()
                .filter(step -> step != null && !step.isBlank())
                .map(String::trim)
                .collect(Collectors.joining("\n"));
    }

    private Map<Integer, String> resolveReviewerNames(Collection<ContentRecipeSuggestion> suggestions) {
        Set<Integer> reviewerIds = suggestions.stream()
                .map(ContentRecipeSuggestion::getReviewedBy)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (reviewerIds.isEmpty()) {
            return Map.of();
        }
        return userRepository.findAllById(reviewerIds).stream()
                .collect(Collectors.toMap(User::getUserId, this::displayName, (a, b) -> a));
    }

    private String displayName(User user) {
        if (user == null) {
            return null;
        }
        return user.getFullName() != null && !user.getFullName().isBlank()
                ? user.getFullName()
                : user.getUsername();
    }

    private String uniqueSlug(String name, String fallback, Predicate<String> exists) {
        String base = RecipeTextNormalizer.slugify(name);
        if (base.isBlank()) {
            base = fallback;
        }
        String candidate = base;
        int counter = 1;
        while (exists.test(candidate)) {
            candidate = base + "-" + counter++;
        }
        return candidate;
    }

    private ContentRecipeSuggestionResponse toResponse(
            ContentRecipeSuggestion suggestion,
            Map<Integer, String> reviewerNames) {
        return toResponse(suggestion, reviewerNames, false);
    }

    private ContentRecipeSuggestionResponse toResponse(
            ContentRecipeSuggestion suggestion,
            Map<Integer, String> reviewerNames,
            boolean includeValidation) {
        Content content = suggestion.getContent();
        String reviewerName = suggestion.getReviewedBy() == null
                ? null
                : reviewerNames.get(suggestion.getReviewedBy());

        return ContentRecipeSuggestionResponse.builder()
                .suggestionId(suggestion.getSuggestionId())
                .status(suggestion.getStatus())
                .dishId(suggestion.getDishId())
                .recipeId(suggestion.getRecipeId())
                .createdAt(suggestion.getCreatedAt())
                .reviewedAt(suggestion.getReviewedAt())
                .reviewerName(reviewerName)
                .rejectionReason(suggestion.getRejectionReason())
                .sourceContent(ContentRecipeSuggestionResponse.SourceContent.builder()
                        .contentId(content != null ? content.getContentId() : null)
                        .contentType(content != null ? content.getContentType() : null)
                        .title(content != null ? content.getTitle() : null)
                        .authorName(content != null && content.getUser() != null
                                ? displayName(content.getUser())
                                : null)
                        .viewCount(suggestion.getSourceViewCount())
                        .voteCount(suggestion.getSourceVoteCount())
                        .createdAt(content != null ? content.getCreatedAt() : null)
                        .recipeConsent(content != null ? Boolean.TRUE.equals(content.getRecipeConsent()) : null)
                        .recipeConsentAt(content != null ? content.getRecipeConsentAt() : null)
                        .recipeConsentTermsVersion(content != null ? content.getRecipeConsentTermsVersion() : null)
                        .build())
                .dish(ContentRecipeSuggestionResponse.DishInfo.builder()
                        .name(suggestion.getDishName())
                        .description(suggestion.getDishDescription())
                        .servingSize(suggestion.getServingSize())
                        .servingUnit(suggestion.getServingUnit())
                        .build())
                .nutrition(ContentRecipeSuggestionResponse.NutritionInfo.builder()
                        .calories(suggestion.getCalories())
                        .proteinG(suggestion.getProteinG())
                        .carbsG(suggestion.getCarbsG())
                        .fatG(suggestion.getFatG())
                        .fiberG(suggestion.getFiberG())
                        .build())
                .ingredients(payloadReader.readIngredients(suggestion.getIngredientsJson()).value().stream()
                        .map(ingredient -> ContentRecipeSuggestionResponse.IngredientInfo.builder()
                                .name(ingredient.name())
                                .quantity(ingredient.quantity())
                                .unit(ingredient.unit())
                                .notes(ingredient.notes())
                                .build())
                        .toList())
                .recipe(ContentRecipeSuggestionResponse.RecipeInfo.builder()
                        .title(suggestion.getRecipeTitle())
                        .description(suggestion.getRecipeDescription())
                        .prepTimeMin(suggestion.getPrepTimeMin())
                        .cookTimeMin(suggestion.getCookTimeMin())
                        .servings(suggestion.getServings())
                        .steps(payloadReader.readSteps(suggestion.getRecipeStepsJson()).value())
                        .build())
                .restaurant(ContentRecipeSuggestionResponse.RestaurantInfo.builder()
                        .name(suggestion.getRestaurantName())
                        .address(suggestion.getRestaurantAddress())
                        .reference(suggestion.getRestaurantReference())
                        .build())
                .validation(includeValidation ? validator.validate(suggestion) : null)
                .build();
    }
}
