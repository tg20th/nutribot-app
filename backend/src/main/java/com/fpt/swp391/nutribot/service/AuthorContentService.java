package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.ContentCreateRequest;
import com.fpt.swp391.nutribot.dto.request.ContentUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.AuthorContentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.Category;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.ContentModeration;
import com.fpt.swp391.nutribot.entity.RecipeConsentAuditLog;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.event.ContentModerationRequestedEvent;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.ForbiddenException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.CategoryRepository;
import com.fpt.swp391.nutribot.repository.ContentModerationRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.RecipeConsentAuditLogRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthorContentService {

    private final ContentRepository contentRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final CloudinaryMediaService cloudinaryMediaService;
    private final ContentModerationGatewayService contentModerationGatewayService;
    private final ContentModerationRepository contentModerationRepository;
    private final RecipeConsentAuditLogRepository recipeConsentAuditLogRepository;
    private final ContentRecipeSuggestionService contentRecipeSuggestionService;
    private final RecipeConsentRevocationService recipeConsentRevocationService;
    private final ApplicationEventPublisher applicationEventPublisher;

    private static final String STATUS_DRAFT = "draft";
    public static final String STATUS_UNDER_REVIEW = "under_review";
    public static final String STATUS_AI_PROCESSING = "ai_processing";
    public static final String STATUS_PUBLISHED = "published";
    private static final String STATUS_REJECTED = "rejected";
    private static final List<String> AUTHOR_ALLOWED_STATUSES = List.of(STATUS_DRAFT, STATUS_UNDER_REVIEW);

    /** Phiên bản điều khoản đồng thuận dùng công thức (NB-80). */
    public static final String RECIPE_CONSENT_TERMS_VERSION = "v1";

    @Transactional(readOnly = true)
    public PagedResponse<AuthorContentResponse> getMyContent(String username, String contentType, int page, int size) {
        log.info("getMyContent - username: {}, contentType: {}, page: {}, size: {}", username, contentType, page, size);

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt"));

        Page<Content> contentPage;
        if (contentType == null || contentType.isEmpty()) {
            contentPage = contentRepository.findByUserUserId(user.getUserId(), pageable);
        } else {
            contentPage = contentRepository.findByUserUserIdAndContentType(user.getUserId(), contentType, pageable);
        }

        Page<AuthorContentResponse> responsePage = contentPage.map(this::toAuthorResponse);
        return PagedResponse.of(responsePage);
    }

    @Transactional
    public AuthorContentResponse createContent(String username, String contentType, ContentCreateRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        if (request.getCategoryId() != null) {
            validateCategory(request.getCategoryId());
        }

        validateVideoFields(contentType, request.getMediaUrl(), request.getDurationSec());

        boolean consentGranted = Boolean.TRUE.equals(request.getRecipeConsent());
        Content content = Content.builder()
                .user(user)
                .contentType(contentType)
                .categoryId(request.getCategoryId())
                .title(request.getTitle())
                .slug(generateSlug(request.getTitle()))
                .body(request.getBody())
                .mediaUrl(request.getMediaUrl())
                .thumbnailUrl(request.getThumbnailUrl())
                .durationSec(request.getDurationSec())
                .status(STATUS_DRAFT) // Bài viết/video mới tạo luôn là draft
                .recipeConsent(consentGranted)
                .recipeConsentAt(consentGranted ? LocalDateTime.now() : null)
                .recipeConsentTermsVersion(consentGranted ? resolveTermsVersion(request.getRecipeConsentTermsVersion()) : null)
                .viewCount(0)
                .build();

        Content saved = contentRepository.save(content);
        if (consentGranted) {
            saveConsentAudit(user, saved, null, true, "CREATE");
        }
        return toAuthorResponse(saved);
    }

    @Transactional(readOnly = true)
    public AuthorContentResponse getContentById(String username, Integer contentId) {
        return getContentById(username, contentId, null);
    }

    @Transactional(readOnly = true)
    public AuthorContentResponse getContentById(String username, Integer contentId, String expectedContentType) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new NotFoundException(getNotFoundMessage(expectedContentType)));

        if (expectedContentType != null && !expectedContentType.equalsIgnoreCase(content.getContentType())) {
            throw new NotFoundException(getNotFoundMessage(expectedContentType));
        }

        if (!content.getUser().getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền xem nội dung này");
        }

        return toAuthorResponse(content);
    }

    @Transactional
    public AuthorContentResponse updateContent(String username, Integer contentId, ContentUpdateRequest request) {
        return updateContent(username, contentId, null, request);
    }

    @Transactional
    public AuthorContentResponse updateContent(String username, Integer contentId, String expectedContentType, ContentUpdateRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new NotFoundException(getNotFoundMessage(expectedContentType)));

        if (expectedContentType != null && !expectedContentType.equalsIgnoreCase(content.getContentType())) {
            throw new NotFoundException(getNotFoundMessage(expectedContentType));
        }

        if (!content.getUser().getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa nội dung này");
        }

        validateVideoFields(content.getContentType(), request.getMediaUrl(), request.getDurationSec());

        if (request.getCategoryId() != null) {
            validateCategory(request.getCategoryId());
            content.setCategoryId(request.getCategoryId());
        }

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            content.setTitle(request.getTitle());
            content.setSlug(generateSlug(request.getTitle()));
        }
        if (request.getBody() != null) {
            content.setBody(request.getBody());
        }
        if (request.getMediaUrl() != null) {
            content.setMediaUrl(request.getMediaUrl());
        }
        if (request.getThumbnailUrl() != null) {
            // Nếu thay đổi thumbnail, có thể dọn thumbnail cũ
            String oldThumbnail = content.getThumbnailUrl();
            if (oldThumbnail != null && !oldThumbnail.equals(request.getThumbnailUrl())) {
                cloudinaryMediaService.deleteThumbnailByUrl(oldThumbnail);
            }
            content.setThumbnailUrl(request.getThumbnailUrl());
        }
        if (request.getDurationSec() != null) {
            content.setDurationSec(request.getDurationSec());
        }

        // NB-80: Thay đổi đồng thuận dùng công thức (false -> true đặt timestamp + terms;
        // true -> false xóa timestamp/terms) và ghi audit log
        if (request.getRecipeConsent() != null) {
            boolean previousConsent = Boolean.TRUE.equals(content.getRecipeConsent());
            boolean newConsent = Boolean.TRUE.equals(request.getRecipeConsent());
            if (previousConsent != newConsent) {
                content.setRecipeConsent(newConsent);
                content.setRecipeConsentAt(newConsent ? LocalDateTime.now() : null);
                content.setRecipeConsentTermsVersion(newConsent ? resolveTermsVersion(request.getRecipeConsentTermsVersion()) : null);
                saveConsentAudit(user, content, previousConsent, newConsent, "UPDATE");
                // NB-84: Bài không còn đồng thuận thì đề xuất công thức đang chờ phải đóng lại,
                // nếu không sẽ kẹt PENDING vô tận (admin không thể duyệt vì bị chặn consent).
                if (!newConsent) {
                    recipeConsentRevocationService.revokePendingSuggestions(contentId, user.getUserId());
                }
            }
        }

        // State Machine Guard
        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            String requestedStatus = request.getStatus().trim().toLowerCase();
            if (!AUTHOR_ALLOWED_STATUSES.contains(requestedStatus)) {
                throw new BadRequestException("Tác giả không có quyền chuyển sang trạng thái này: " + request.getStatus());
            }
            content.setStatus(requestedStatus);
        } else {
            // Nếu không yêu cầu status cụ thể, nhưng bài đang là PUBLISHED hoặc REJECTED:
            // Tác giả sửa nội dung -> tự động hạ trạng thái về draft để kiểm duyệt lại
            if (STATUS_PUBLISHED.equalsIgnoreCase(content.getStatus()) || STATUS_REJECTED.equalsIgnoreCase(content.getStatus())) {
                log.info("Nội dung {} đang ở trạng thái {}, tác giả cập nhật -> tự động hạ về DRAFT", contentId, content.getStatus());
                content.setStatus(STATUS_DRAFT);
            }
        }

        Content saved = contentRepository.save(content);
        return toAuthorResponse(saved);
    }

    @Transactional
    public AuthorContentResponse submitContent(String username, Integer contentId) {
        return submitContent(username, contentId, null);
    }

    /**
     * Nộp bài để chờ duyệt. Phương thức chỉ:
     * <ol>
     *   <li>Set trạng thái {@code ai_processing} (không chờ AI)</li>
     *   <li>Phát sự kiện {@link ContentModerationRequestedEvent} để listener bất đồng bộ
     *       gọi AI moderation và cập nhật trạng thái cuối cùng</li>
     *   <li>Trả về response ngay lập tức (vài chục ms) — không block request</li>
     * </ol>
     * Nhờ vậy, khi tác giả bấm "Post", UI không phải chờ AI service (timeout 30s)
     * và vòng loading không quay liên tục.
     */
    @Transactional
    public AuthorContentResponse submitContent(String username, Integer contentId, String expectedContentType) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new NotFoundException(getNotFoundMessage(expectedContentType)));

        if (expectedContentType != null && !expectedContentType.equalsIgnoreCase(content.getContentType())) {
            throw new NotFoundException(getNotFoundMessage(expectedContentType));
        }

        if (!content.getUser().getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền thao tác trên nội dung này");
        }

        // NB-80 (sua nghiep vu): Bai co cong thuc nhung tac gia CHUA cho phep
        // van duoc nop bai/binh thuong — chi khong tao suggestion de xuat mon an
        // cho admin (gate o ContentRecipeSuggestionService.evaluateContent).

        // Set sang AI_PROCESSING để FE phân biệt đang chờ AI vs chờ Admin duyệt
        content.setStatus(STATUS_AI_PROCESSING);
        Content saved = contentRepository.save(content);
        log.info("Content {} chuyển sang {} (author: {})", contentId, STATUS_AI_PROCESSING, username);

        // Phát event để listener xử lý AI moderation bất đồng bộ
        applicationEventPublisher.publishEvent(
                new ContentModerationRequestedEvent(
                        content.getContentId(),
                        content.getContentType(),
                        user.getUserId()
                )
        );

        AuthorContentResponse response = toAuthorResponse(saved);
        applyRecipeSuggestionGuidance(saved, response);
        return response;
    }

    /**
     * NB-80: Gắn vào response thông báo về trạng thái đề xuất công thức:
     * - Chưa cho phép -> bai van duyet/binh thuong nhung khong de xuat mon an.
     * - Da cho phep -> thong bao dieu kien de xat (du luot xem/danh gia, chua co suggestion).
     */
    private void applyRecipeSuggestionGuidance(Content content, AuthorContentResponse response) {
        if (!Boolean.TRUE.equals(content.getRecipeConsent())) {
            response.setRecipeConsentEligible(false);
            response.setRecipeConsentMessage(
                    "Your post is in the review queue. You have not allowed NutriBot "
                    + "to use the recipe, so no dish will be suggested to admins from this post.");
            return;
        }
        boolean eligible = contentRecipeSuggestionService.isConsentEligibleNow(content);
        response.setRecipeConsentEligible(eligible);
        if (eligible) {
            response.setRecipeConsentMessage(
                    "Your post is in the review queue. Once published, "
                    + "NutriBot will automatically suggest this recipe to admins.");
        } else {
            response.setRecipeConsentMessage(String.format(
                    "Your post is in the review queue. It does not yet meet the recipe "
                    + "suggestion conditions (needs at least %d views and %d votes); "
                    + "the system will suggest it automatically once eligible.",
                    contentRecipeSuggestionService.getMinViews(),
                    contentRecipeSuggestionService.getMinVotes()));
        }
    }

    private void saveOrUpdateModeration(Integer contentId, ContentModerationGatewayService.ModerationResult moderation, boolean isApproved) {
        try {
            ContentModeration cm = contentModerationRepository.findByContentId(contentId)
                    .orElseGet(() -> ContentModeration.builder()
                            .contentId(contentId)
                            .createdAt(LocalDateTime.now())
                            .build());

            cm.setAiFlagged(!isApproved);
            cm.setAiReason(moderation.reason());
            if (moderation.confidence() != null) {
                double conf = Math.max(0.0, Math.min(1.0, moderation.confidence()));
                cm.setAiConfidence(BigDecimal.valueOf(conf).setScale(4, RoundingMode.HALF_UP));
            }
            cm.setStatus(isApproved ? "approved" : "pending");
            contentModerationRepository.save(cm);
            log.info("Lưu thành công kết quả kiểm duyệt AI vào content_moderations cho content {}: status={}, aiFlagged={}",
                    contentId, cm.getStatus(), cm.getAiFlagged());
        } catch (Exception e) {
            log.error("Không thể lưu kết quả kiểm duyệt AI cho content {}: {}", contentId, e.getMessage(), e);
        }
    }

    @Transactional
    public AuthorContentResponse recallContent(String username, Integer contentId) {
        return recallContent(username, contentId, null);
    }

    @Transactional
    public AuthorContentResponse recallContent(String username, Integer contentId, String expectedContentType) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new NotFoundException(getNotFoundMessage(expectedContentType)));

        if (expectedContentType != null && !expectedContentType.equalsIgnoreCase(content.getContentType())) {
            throw new NotFoundException(getNotFoundMessage(expectedContentType));
        }

        if (!content.getUser().getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền thao tác trên nội dung này");
        }

        content.setStatus(STATUS_DRAFT);
        Content saved = contentRepository.save(content);
        log.info("Tác giả {} đã rút nội dung {} về trạng thái {}", username, contentId, STATUS_DRAFT);
        return toAuthorResponse(saved);
    }

    @Transactional
    public void deleteContent(String username, Integer contentId) {
        deleteContent(username, contentId, null);
    }

    @Transactional
    public void deleteContent(String username, Integer contentId, String expectedContentType) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new NotFoundException(getNotFoundMessage(expectedContentType)));

        if (expectedContentType != null && !expectedContentType.equalsIgnoreCase(content.getContentType())) {
            throw new NotFoundException(getNotFoundMessage(expectedContentType));
        }

        if (!content.getUser().getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền xóa nội dung này");
        }

        String thumbnailUrl = content.getThumbnailUrl();
        contentRepository.delete(content);

        // Dọn dẹp thumbnail an toàn (fault-tolerant)
        if (thumbnailUrl != null && !thumbnailUrl.isBlank()) {
            cloudinaryMediaService.deleteThumbnailByUrl(thumbnailUrl);
        }
    }

    private void validateVideoFields(String contentType, String mediaUrl, Integer durationSec) {
        if ("VIDEO".equalsIgnoreCase(contentType)) {
            if (durationSec != null) {
                if (durationSec <= 0) {
                    throw new BadRequestException("Thời lượng video phải lớn hơn 0");
                }
                if (durationSec > 86400) {
                    throw new BadRequestException("Thời lượng video không được vượt quá 24 giờ");
                }
            }
            if (mediaUrl != null && !mediaUrl.isBlank()) {
                validateMediaUrl(mediaUrl);
            }
        }
    }

    private void validateMediaUrl(String mediaUrl) {
        String trimmed = mediaUrl.trim().toLowerCase();
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            throw new BadRequestException("Đường dẫn media không hợp lệ");
        }
    }

    private String getNotFoundMessage(String expectedContentType) {
        if ("VIDEO".equalsIgnoreCase(expectedContentType)) {
            return "Video không tồn tại";
        }
        return "Bài viết không tồn tại";
    }

    private void validateCategory(Integer categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new BadRequestException("Danh mục không tồn tại"));

        if (!Boolean.TRUE.equals(category.getActive())) {
            throw new BadRequestException("Danh mục hiện đang bị vô hiệu hóa");
        }

        if (category.getCategoryType() == null || !category.getCategoryType().equalsIgnoreCase("RECIPE")) {
            throw new BadRequestException("Danh mục không hợp lệ hoặc không hỗ trợ nội dung bài viết/video");
        }
    }

    private String generateSlug(String title) {
        if (title == null || title.isBlank()) {
            return "post-" + System.currentTimeMillis();
        }

        String normalized = Normalizer.normalize(title, Normalizer.Form.NFD);
        Pattern pattern = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
        String ascii = pattern.matcher(normalized).replaceAll("").replace('đ', 'd').replace('Đ', 'D');

        String baseSlug = ascii.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .trim();

        if (baseSlug.isBlank()) {
            baseSlug = "post";
        }

        String candidate = baseSlug + "-" + System.currentTimeMillis();
        if (contentRepository.existsBySlug(candidate)) {
            candidate = candidate + "-" + UUID.randomUUID().toString().substring(0, 6);
        }

        return candidate;
    }

    private AuthorContentResponse toAuthorResponse(Content content) {
        String avatar = content.getUser() != null ? content.getUser().getAvatarUrl() : null;
        return AuthorContentResponse.builder()
                .contentId(content.getContentId())
                .contentType(content.getContentType())
                .title(content.getTitle())
                .slug(content.getSlug())
                .body(content.getBody())
                .categoryId(content.getCategoryId())
                .mediaUrl(content.getMediaUrl())
                .thumbnailUrl(content.getThumbnailUrl())
                .durationSec(content.getDurationSec())
                .status(content.getStatus())
                .authorId(content.getUser() != null ? content.getUser().getUserId() : null)
                .authorUsername(content.getUser() != null ? content.getUser().getUsername() : null)
                .authorName(content.getUser() != null ? content.getUser().getFullName() : null)
                .authorAvatar(avatar)
                .avatarUrl(avatar)
                .viewCount(content.getViewCount())
                .createdAt(content.getCreatedAt())
                .updatedAt(content.getUpdatedAt())
                .recipeConsent(Boolean.TRUE.equals(content.getRecipeConsent()))
                .recipeConsentAt(content.getRecipeConsentAt())
                .recipeConsentTermsVersion(content.getRecipeConsentTermsVersion())
                .build();
    }

    /**
     * NB-80: Chuẩn hóa phiên bản điều khoản đồng thuận từ client.
     * Nếu client gửi null hoặc rỗng -> dùng phiên bản hiện hành {@code v1}.
     * Nếu gửi chuỗi khác -> cắt về 20 ký tự theo giới hạn cột DB.
     */
    private String resolveTermsVersion(String clientVersion) {
        if (clientVersion == null || clientVersion.isBlank()) {
            return RECIPE_CONSENT_TERMS_VERSION;
        }
        String trimmed = clientVersion.trim();
        return trimmed.length() > 20 ? trimmed.substring(0, 20) : trimmed;
    }

    /**
     * NB-80: Ghi một dòng vào bảng audit append-only {@code recipe_consent_audit_log}.
     */
    private void saveConsentAudit(User user, Content content, Boolean previousValue, boolean newValue, String source) {
        try {
            recipeConsentAuditLogRepository.save(RecipeConsentAuditLog.builder()
                    .userId(user.getUserId())
                    .contentId(content.getContentId())
                    .previousValue(previousValue)
                    .newValue(newValue)
                    .termsVersion(content.getRecipeConsentTermsVersion())
                    .source(source)
                    .build());
        } catch (Exception e) {
            log.warn("Không ghi được audit log đồng thuận cho content {}: {}", content.getContentId(), e.getMessage());
        }
    }

    private String extractDescription(String body) {
        if (body == null || body.isBlank()) {
            return "";
        }
        // Extract first ~200 chars as description
        String text = body.replaceAll("<[^>]*>", "").trim();
        if (text.length() <= 200) {
            return text;
        }
        return text.substring(0, 200) + "...";
    }

    private String getCategoryName(Integer categoryId) {
        if (categoryId == null) {
            return "";
        }
        return categoryRepository.findById(categoryId)
                .map(Category::getCategoryName)
                .orElse("");
    }
}
