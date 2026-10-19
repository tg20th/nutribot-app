package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.request.ContentRecipeSuggestionReviewRequest;
import com.fpt.swp391.nutribot.dto.response.ContentRecipeSuggestionResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * NB-61: Admin xem, duyệt hoặc từ chối các đề xuất món ăn sinh ra từ nội dung
 * Blog/Video giá trị cao. Khi duyệt phải revalidate nội dung nguồn và nhập dữ
 * liệu món ăn/công thức/nguyên liệu vào canonical catalog một cách an toàn
 * (transaction all-or-nothing, có khóa chống hai Admin xử lý trùng).
 */
@Slf4j
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
    private static final Pattern COMBINING_MARKS = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
    private static final int MAX_PAGE_SIZE = 50;

    private final ContentRecipeSuggestionRepository suggestionRepository;
    private final ContentRepository contentRepository;
    private final DishRepository dishRepository;
    private final RecipeRepository recipeRepository;
    private final IngredientRepository ingredientRepository;
    private final RecipeIngredientRepository recipeIngredientRepository;
    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final VegetarianTypeClassifier vegetarianTypeClassifier;
    private final String dishDefaultCategorySlug;
    private final String ingredientDefaultCategorySlug;
    private final String recipeStatus;

    public ContentRecipeSuggestionReviewService(
            ContentRecipeSuggestionRepository suggestionRepository,
            ContentRepository contentRepository,
            DishRepository dishRepository,
            RecipeRepository recipeRepository,
            IngredientRepository ingredientRepository,
            RecipeIngredientRepository recipeIngredientRepository,
            CategoryRepository categoryRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper,
            VegetarianTypeClassifier vegetarianTypeClassifier,
            @Value("${app.content-recipe-suggestion.dish-default-category-slug:salad-healthy}") String dishDefaultCategorySlug,
            @Value("${app.content-recipe-suggestion.ingredient-default-category-slug:rau-cu}") String ingredientDefaultCategorySlug,
            @Value("${app.content-recipe-suggestion.recipe-status:verified}") String recipeStatus) {
        this.suggestionRepository = suggestionRepository;
        this.contentRepository = contentRepository;
        this.dishRepository = dishRepository;
        this.recipeRepository = recipeRepository;
        this.ingredientRepository = ingredientRepository;
        this.recipeIngredientRepository = recipeIngredientRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.vegetarianTypeClassifier = vegetarianTypeClassifier;
        this.dishDefaultCategorySlug = dishDefaultCategorySlug;
        this.ingredientDefaultCategorySlug = ingredientDefaultCategorySlug;
        this.recipeStatus = recipeStatus;
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
        return toResponse(suggestion, resolveReviewerNames(List.of(suggestion)));
    }

    @Transactional
    public ContentRecipeSuggestionResponse review(
            Integer suggestionId,
            ContentRecipeSuggestionReviewRequest request,
            String adminUsername) {
        ContentRecipeSuggestion suggestion = suggestionRepository.findByIdForUpdate(suggestionId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy đề xuất với ID: " + suggestionId));

        if (!STATUS_PENDING.equalsIgnoreCase(suggestion.getStatus())) {
            throw new ConflictException("Đề xuất đã được xử lý với trạng thái: " + suggestion.getStatus());
        }

        User admin = resolveAdmin(adminUsername);
        String action = request.getAction() == null ? "" : request.getAction().trim().toUpperCase();

        switch (action) {
            case ACTION_APPROVE -> approve(suggestion, admin);
            case ACTION_REJECT -> reject(suggestion, request.getRejectionReason(), admin);
            default -> throw new BadRequestException("Action không hợp lệ: " + request.getAction());
        }

        suggestionRepository.save(suggestion);
        return toResponse(suggestion, Map.of(admin.getUserId(), displayName(admin)));
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

        // NB-80: Chốt chặn cuối — nội dung nguồn đã bị gỡ đồng thuận thì không import được
        if (!Boolean.TRUE.equals(freshContent.getRecipeConsent())) {
            throw new BadRequestException(
                    "Tác giả chưa đồng thuận cho phép dùng công thức của bài viết này");
        }

        Dish dish = resolveOrCreateDish(suggestion, freshContent);
        Recipe recipe = resolveOrCreateRecipe(suggestion, dish, admin, freshContent);
        persistIngredients(suggestion, recipe);

        suggestion.setDishId(dish.getDishId());
        suggestion.setRecipeId(recipe.getRecipeId());
        suggestion.setStatus(STATUS_APPROVED);
        suggestion.setRejectionReason(null);
        suggestion.setReviewedBy(admin.getUserId());
        suggestion.setReviewedAt(LocalDateTime.now());
    }

    private Dish resolveOrCreateDish(ContentRecipeSuggestion suggestion, Content content) {
        String dishName = suggestion.getDishName() == null ? null : suggestion.getDishName().trim();
        if (dishName == null || dishName.isEmpty()) {
            throw new BadRequestException("Đề xuất thiếu tên món ăn, không thể duyệt");
        }

        return dishRepository.findByNameIgnoreCase(dishName).orElseGet(() -> dishRepository.save(Dish.builder()
                .name(dishName)
                .slug(uniqueSlug(dishName, "dish", dishRepository::existsBySlug))
                .description(suggestion.getDishDescription())
                .categoryId(resolveDishCategoryId(content))
                .imageUrl(content.getThumbnailUrl())
                .vegetarianType(classifyVegetarianType(suggestion))
                .calories(suggestion.getCalories())
                .proteinG(suggestion.getProteinG())
                .carbsG(suggestion.getCarbsG())
                .healthyFatsG(suggestion.getFatG())
                .servingSize(suggestion.getServingSize())
                .servingUnit(suggestion.getServingUnit())
                .active(true)
                .build()));
    }

    private String classifyVegetarianType(ContentRecipeSuggestion suggestion) {
        List<String> names = readIngredients(suggestion.getIngredientsJson()).stream()
                .filter(proposal -> proposal != null && proposal.name() != null)
                .map(RecipeExtractionGatewayService.IngredientProposal::name)
                .toList();
        String vegetarianType = vegetarianTypeClassifier.classify(names);
        if (vegetarianType == null) {
            log.warn("Không suy diễn được loại ăn chay cho đề xuất {} (nguyên liệu chứa thịt hoặc thiếu dữ liệu)",
                    suggestion.getSuggestionId());
        }
        return vegetarianType;
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
                    .status(recipeStatus)
                    .build());
        });
    }

    private void persistIngredients(ContentRecipeSuggestion suggestion, Recipe recipe) {
        for (RecipeExtractionGatewayService.IngredientProposal proposal : readIngredients(suggestion.getIngredientsJson())) {
            if (proposal == null || proposal.name() == null || proposal.name().isBlank()) {
                continue;
            }
            Ingredient ingredient = resolveOrCreateIngredient(proposal.name());
            RecipeIngredientId id = new RecipeIngredientId(recipe.getRecipeId(), ingredient.getIngredientId());
            if (recipeIngredientRepository.existsById(id)) {
                continue;
            }
            BigDecimal quantity = proposal.quantity() != null && proposal.quantity().compareTo(BigDecimal.ZERO) > 0
                    ? proposal.quantity()
                    : BigDecimal.ONE;
            String unit = proposal.unit() == null || proposal.unit().isBlank() ? "g" : proposal.unit().trim();
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
        List<String> steps = readSteps(stepsJson);
        if (steps.isEmpty()) {
            return null;
        }
        return steps.stream()
                .filter(step -> step != null && !step.isBlank())
                .map(String::trim)
                .collect(Collectors.joining("\n"));
    }

    private List<RecipeExtractionGatewayService.IngredientProposal> readIngredients(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json,
                    new TypeReference<List<RecipeExtractionGatewayService.IngredientProposal>>() {});
        } catch (Exception ex) {
            log.warn("Không đọc được ingredients_json của đề xuất: {}", ex.getMessage());
            return List.of();
        }
    }

    private List<String> readSteps(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception ex) {
            log.warn("Không đọc được recipe_steps_json của đề xuất: {}", ex.getMessage());
            return List.of();
        }
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
        String base = slugify(name);
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

    private String slugify(String input) {
        if (input == null) {
            return "";
        }
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD);
        String ascii = COMBINING_MARKS.matcher(normalized).replaceAll("").replace('đ', 'd').replace('Đ', 'D');
        return ascii.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }

    private ContentRecipeSuggestionResponse toResponse(
            ContentRecipeSuggestion suggestion,
            Map<Integer, String> reviewerNames) {
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
                .ingredients(readIngredients(suggestion.getIngredientsJson()).stream()
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
                        .steps(readSteps(suggestion.getRecipeStepsJson()))
                        .build())
                .restaurant(ContentRecipeSuggestionResponse.RestaurantInfo.builder()
                        .name(suggestion.getRestaurantName())
                        .address(suggestion.getRestaurantAddress())
                        .reference(suggestion.getRestaurantReference())
                        .build())
                .build();
    }
}
