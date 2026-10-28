package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestion;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestionAudit;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestionIngredient;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestionStep;
import com.fpt.swp391.nutribot.repository.ContentRecipeSuggestionRepository;
import com.fpt.swp391.nutribot.repository.ContentRecipeSuggestionIngredientRepository;
import com.fpt.swp391.nutribot.repository.ContentRecipeSuggestionStepRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.DishRepository;
import com.fpt.swp391.nutribot.repository.VoteRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * NB-60: Phát hiện nội dung Blog/Video đã publish có giá trị cao và đề xuất
 * chuyển hóa thành món ăn / công thức. Service chỉ tạo bản ghi suggestion ở
 * trạng thái PENDING; việc duyệt thuộc NB-61, tự tạo Dish/Recipe thuộc phạm vi khác.
 */
@Slf4j
@Service
public class ContentRecipeSuggestionService {

    /** Trạng thái suggestion đang "chiếm chỗ" nội dung, không cho tạo trùng. */
    private static final List<String> ACTIVE_STATUSES = List.of("PENDING", "APPROVED");

    private final ContentRepository contentRepository;
    private final VoteRepository voteRepository;
    private final ContentRecipeSuggestionRepository suggestionRepository;
    private final ContentRecipeSuggestionIngredientRepository suggestionIngredientRepository;
    private final ContentRecipeSuggestionStepRepository suggestionStepRepository;
    private final DishRepository dishRepository;
    private final ContentRecipeBodyParser bodyParser;
    private final RecipeExtractionGatewayService extractionGateway;
    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final int minViews;
    private final int minVotes;
    private final RecipeSuggestionAuditService auditService;
    private final ObjectProvider<ContentRecipeSuggestionService> selfProvider;

    public ContentRecipeSuggestionService(
            ContentRepository contentRepository,
            VoteRepository voteRepository,
            ContentRecipeSuggestionRepository suggestionRepository,
            ContentRecipeSuggestionIngredientRepository suggestionIngredientRepository,
            ContentRecipeSuggestionStepRepository suggestionStepRepository,
            DishRepository dishRepository,
            ContentRecipeBodyParser bodyParser,
            RecipeExtractionGatewayService extractionGateway,
            ObjectMapper objectMapper,
            @Value("${app.content-recipe-suggestion.enabled:true}") boolean enabled,
            @Value("${app.content-recipe-suggestion.min-views:500}") int minViews,
            @Value("${app.content-recipe-suggestion.min-votes:10}") int minVotes,
            RecipeSuggestionAuditService auditService,
            ObjectProvider<ContentRecipeSuggestionService> selfProvider) {
        this.contentRepository = contentRepository;
        this.voteRepository = voteRepository;
        this.suggestionRepository = suggestionRepository;
        this.suggestionIngredientRepository = suggestionIngredientRepository;
        this.suggestionStepRepository = suggestionStepRepository;
        this.dishRepository = dishRepository;
        this.bodyParser = bodyParser;
        this.extractionGateway = extractionGateway;
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.minViews = minViews;
        this.minVotes = minVotes;
        this.auditService = auditService;
        this.selfProvider = selfProvider;
    }

    /**
     * Hook sau khi Admin duyệt nội dung sang published. Chạy bất đồng bộ để không
     * làm chậm API duyệt và không giữ transaction trong lúc gọi AI service.
     */
    @Async
    public void evaluateContentById(Integer contentId) {
        if (contentId == null) {
            return;
        }
        try {
            contentRepository.findById(contentId).ifPresent(this::evaluateContentInOwnTransaction);
        } catch (Exception ex) {
            log.error("Đánh giá suggestion thất bại cho content {}: {}", contentId, ex.getMessage());
        }
    }

    /**
     * Quét toàn bộ nội dung published đủ ngưỡng view để tạo suggestion còn thiếu.
     * Dùng cho job định kỳ vì view/vote tăng dần theo thời gian.
     * <p>
     * Mỗi nội dung được đánh giá trong MỘT transaction riêng ({@link #evaluateContent})
     * để một nội dung lỗi (ví dụ trùng ràng buộc unique) không làm hỏng cả lượt quét,
     * và không để lại transaction treo chờ khoá.
     */
    public int evaluateEligibleContents() {
        if (!enabled) {
            return 0;
        }
        int created = 0;
        for (Content content : contentRepository.findByStatusAndViewCountGreaterThanEqual("published", minViews)) {
            try {
                if (evaluateContentInOwnTransaction(content)) {
                    created++;
                }
            } catch (Exception ex) {
                log.warn("Bỏ qua nội dung {} khi quét suggestion: {}", content.getContentId(), ex.getMessage());
            }
        }
        return created;
    }

    /**
     * Gọi {@link #evaluateContent)} qua proxy để đảm bảo transaction mới được mở
     * (self-invocation trực tiếp sẽ không kích hoạt {@code @Transactional}).
     */
    private boolean evaluateContentInOwnTransaction(Content content) {
        return selfProvider.getObject().evaluateContent(content);
    }

    /**
     * Đánh giá một nội dung và tạo suggestion nếu đủ điều kiện. Chỉ đề xuất món
     * ăn chưa tồn tại trong hệ thống (so khớp tên với bảng dishes, mọi trạng thái).
     * <p>
     * Luôn chạy trong transaction riêng ({@code REQUIRES_NEW}) để mỗi nội dung độc lập.
     *
     * @return true nếu một suggestion mới được tạo.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean evaluateContent(Content content) {
        if (!enabled || content == null) {
            return false;
        }
        if (!isEligibleContent(content)) {
            return false;
        }

        // NB-80: Tác giả chưa đồng thuận dùng công thức -> không tạo suggestion
        if (!Boolean.TRUE.equals(content.getRecipeConsent())) {
            log.debug("Bỏ qua suggestion cho content {}: tác giả chưa đồng thuận dùng công thức", content.getContentId());
            return false;
        }

        Integer contentId = content.getContentId();
        long voteCount = voteRepository.countByContentId(contentId);
        if (voteCount < minVotes) {
            return false;
        }

        if (suggestionRepository.existsByContentContentIdAndStatusIn(contentId, ACTIVE_STATUSES)) {
            return false;
        }

        // Nguồn chính: parse body JSON do cộng đồng đăng (tất định, không tốn quota AI).
        // AI chỉ là fallback khi body không parse được hoặc thiếu thông tin cốt lõi.
        RecipeExtractionGatewayService.RecipeExtractionResult extraction = bodyParser.parse(content);
        if (!hasCoreInfo(extraction)) {
            extraction = extractionGateway.extractRecipe(content);
        }
        if (!hasCoreInfo(extraction)) {
            log.debug("Nội dung {} đủ ngưỡng nhưng không trích xuất được công thức", contentId);
            return false;
        }

        String dishName = trim(extraction.dish().name());
        if (dishRepository.findByNameIgnoreCase(dishName).isPresent()) {
            log.debug("Món '{}' đã tồn tại trong hệ thống, bỏ qua đề xuất cho content {}", dishName, contentId);
            return false;
        }

        ContentRecipeSuggestion suggestion = buildSuggestion(content, extraction, voteCount);
        try {
            ContentRecipeSuggestion savedSuggestion = suggestionRepository.save(suggestion);
            if (savedSuggestion == null) {
                savedSuggestion = suggestion;
            }
            for (ContentRecipeSuggestionIngredient ingredient : suggestion.getIngredients()) {
                ingredient.setSuggestionId(savedSuggestion.getSuggestionId());
                suggestionIngredientRepository.save(ingredient);
            }
            for (ContentRecipeSuggestionStep step : suggestion.getSteps()) {
                step.setSuggestionId(savedSuggestion.getSuggestionId());
                suggestionStepRepository.save(step);
            }
        } catch (DataIntegrityViolationException ex) {
            // Một luồng khác đã tạo trước đó (ràng buộc unique trên content_id + status active).
            log.debug("Bỏ qua tạo trùng suggestion cho content {}: {}", contentId, ex.getMessage());
            return false;
        }
        // NB-84: Ghi nhật ký lúc hệ thống sinh đề xuất để đối soát lại vòng đời.
        // Ghi trong CÙNG transaction với đề xuất (bảng audit có khoá ngoại tới đề xuất).
        auditService.record(suggestion, ContentRecipeSuggestionAudit.ACTION_SUGGESTED,
                content.getUser() != null ? content.getUser().getUserId() : null,
                "Hệ thống đề xuất công thức từ bài viết đạt điều kiện "
                        + "(" + (content.getViewCount() == null ? 0 : content.getViewCount()) + " lượt xem, "
                        + voteCount + " lượt thích)");
        log.info("Đã tạo recipe suggestion cho content {}", contentId);
        return true;
    }

    /**
     * NB-80: Kiểm tra điều kiện đề xuất TẠI THỜI ĐIỂM NỘP BÀI.
     * Khác {@link #isEligibleContent(Content)}, không yêu cầu trạng thái published
     * (bài vừa nộp đang ở ai_processing/under_review) — chỉ xét các điều kiện
     * người dùng có thể đạt: đã đồng thuận + đủ lượt xem + đủ đánh giá + chưa có
     * suggestion đang hoạt động trong hệ thống.
     */
    public boolean isConsentEligibleNow(Content content) {
        if (!enabled || content == null) {
            return false;
        }
        if (!Boolean.TRUE.equals(content.getRecipeConsent())) {
            return false;
        }
        int views = content.getViewCount() == null ? 0 : content.getViewCount();
        if (views < minViews) {
            return false;
        }
        if (voteRepository.countByContentId(content.getContentId()) < minVotes) {
            return false;
        }
        return !suggestionRepository.existsByContentContentIdAndStatusIn(content.getContentId(), ACTIVE_STATUSES);
    }

    public int getMinViews() {
        return minViews;
    }

    public int getMinVotes() {
        return minVotes;
    }

    private boolean isEligibleContent(Content content) {
        if (!"published".equalsIgnoreCase(content.getStatus())) {
            return false;
        }
        String type = content.getContentType();
        boolean supportedType = type != null
                && (type.equalsIgnoreCase("BLOG") || type.equalsIgnoreCase("VIDEO"));
        if (!supportedType) {
            return false;
        }
        int views = content.getViewCount() == null ? 0 : content.getViewCount();
        return views >= minViews;
    }

    private boolean hasCoreInfo(RecipeExtractionGatewayService.RecipeExtractionResult extraction) {
        if (extraction == null || extraction.dish() == null) {
            return false;
        }
        boolean hasDishName = extraction.dish().name() != null && !extraction.dish().name().isBlank();
        boolean hasIngredients = extraction.ingredients() != null && !extraction.ingredients().isEmpty();
        boolean hasSteps = extraction.recipe() != null
                && extraction.recipe().steps() != null
                && !extraction.recipe().steps().isEmpty();
        return hasDishName && (hasIngredients || hasSteps);
    }

    private ContentRecipeSuggestion buildSuggestion(
            Content content,
            RecipeExtractionGatewayService.RecipeExtractionResult extraction,
            long voteCount) {
        var dish = extraction.dish();
        var nutrition = extraction.nutrition();
        var recipe = extraction.recipe();

        ContentRecipeSuggestion suggestion = ContentRecipeSuggestion.builder()
                .content(content)
                .status("PENDING")
                .sourceViewCount(content.getViewCount() == null ? 0 : content.getViewCount())
                .sourceVoteCount((int) voteCount)
                .dishName(trim(dish.name()))
                .dishDescription(dish.description())
                .servingSize(dish.servingSize())
                .servingUnit(trim(dish.servingUnit()))
                .calories(nutrition != null ? nutrition.calories() : null)
                .proteinG(nutrition != null ? nutrition.proteinG() : null)
                .carbsG(nutrition != null ? nutrition.carbsG() : null)
                .fatG(nutrition != null ? nutrition.fatG() : null)
                .fiberG(nutrition != null ? nutrition.fiberG() : null)
                .recipeTitle(recipe != null ? trim(recipe.title()) : null)
                .recipeDescription(recipe != null ? recipe.description() : null)
                .prepTimeMin(recipe != null ? recipe.prepTimeMin() : null)
                .cookTimeMin(recipe != null ? recipe.cookTimeMin() : null)
                .servings(recipe != null ? recipe.servings() : null)
                .build();
        for (int index = 0; index < extraction.ingredients().size(); index++) {
            var proposal = extraction.ingredients().get(index);
            suggestion.getIngredients().add(ContentRecipeSuggestionIngredient.builder()
                    .suggestion(suggestion)
                    .ingredientName(proposal.name() == null ? "" : proposal.name().trim())
                    .quantity(proposal.quantity())
                    .unit(proposal.unit() == null ? null : proposal.unit().trim())
                    .notes(proposal.notes() == null ? null : proposal.notes().trim())
                    .sortOrder(index + 1)
                    .build());
        }
        if (recipe != null && recipe.steps() != null) {
            for (int index = 0; index < recipe.steps().size(); index++) {
                String instruction = recipe.steps().get(index);
                suggestion.getSteps().add(ContentRecipeSuggestionStep.builder()
                        .suggestion(suggestion)
                        .stepNumber(index + 1)
                        .instruction(instruction == null ? "" : instruction.trim())
                        .build());
            }
        }
        // Legacy in-memory view only; these fields are @Transient and never reach SQL Server.
        suggestion.setIngredientsJson(writeJson(extraction.ingredients()));
        suggestion.setRecipeStepsJson(recipe != null ? writeJson(recipe.steps()) : null);
        return suggestion;
    }

    private String writeJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            log.warn("Không thể serialize dữ liệu suggestion: {}", ex.getMessage());
            return null;
        }
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
