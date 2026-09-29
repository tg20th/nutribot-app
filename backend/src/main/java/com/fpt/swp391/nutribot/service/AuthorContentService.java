package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.ContentCreateRequest;
import com.fpt.swp391.nutribot.dto.request.ContentUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.AuthorContentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.Category;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.ForbiddenException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.CategoryRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthorContentService {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final ContentRepository contentRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final CloudinaryMediaService cloudinaryMediaService;

    private static final String STATUS_DRAFT = "draft";
    private static final String STATUS_UNDER_REVIEW = "under_review";
    private static final String STATUS_PUBLISHED = "published";
    private static final String STATUS_REJECTED = "rejected";
    private static final List<String> AUTHOR_ALLOWED_STATUSES = List.of(STATUS_DRAFT, STATUS_UNDER_REVIEW);

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

        validateCreateRequest(contentType, request);
        validateCategory(request.getCategoryId());

        validateVideoFields(contentType, request.getMediaUrl(), request.getDurationSec());

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
                .prepTimeMin(request.getPrepTimeMin())
                .cookTimeMin(request.getCookTimeMin())
                .servings(request.getServings())
                .calories(request.getCalories())
                .proteinG(request.getProteinG())
                .carbsG(request.getCarbsG())
                .fatG(request.getFatG())
                .fiberG(request.getFiberG())
                .sodiumMg(request.getSodiumMg())
                .ingredientsJson(writeList(request.getIngredients()))
                .stepsJson(writeList(request.getSteps()))
                .status(STATUS_DRAFT) // Bài viết mới tạo luôn là draft
                .viewCount(0)
                .build();

        Content saved = contentRepository.save(content);
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

        content.setStatus(STATUS_UNDER_REVIEW);
        Content saved = contentRepository.save(content);
        log.info("Tác giả {} đã nộp nội dung {} sang trạng thái {}", username, contentId, STATUS_UNDER_REVIEW);
        return toAuthorResponse(saved);
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
        String mediaUrl = content.getMediaUrl();
        contentRepository.delete(content);

        // Dọn dẹp thumbnail an toàn (fault-tolerant)
        if (thumbnailUrl != null && !thumbnailUrl.isBlank()) {
            cloudinaryMediaService.deleteThumbnailByUrl(thumbnailUrl);
        }
        if (mediaUrl != null && !mediaUrl.isBlank()) {
            cloudinaryMediaService.deleteVideoByUrl(mediaUrl);
        }
    }

    private void validateCreateRequest(String contentType, ContentCreateRequest request) {
        if (!"BLOG".equalsIgnoreCase(contentType) && !"VIDEO".equalsIgnoreCase(contentType)) {
            throw new BadRequestException("Loại nội dung phải là BLOG hoặc VIDEO");
        }
        // Canonical unified form must provide every field rendered in the detail screen.
        if (request.getContentType() != null) {
            if (request.getCategoryId() == null) throw new BadRequestException("Vui lòng chọn danh mục");
            if (request.getBody() == null || request.getBody().isBlank()) throw new BadRequestException("Nội dung mô tả không được để trống");
            if (request.getThumbnailUrl() == null || request.getThumbnailUrl().isBlank()) throw new BadRequestException("Vui lòng tải ảnh bìa");
            if (request.getPrepTimeMin() == null || request.getCookTimeMin() == null || request.getServings() == null
                    || request.getCalories() == null || request.getProteinG() == null || request.getCarbsG() == null
                    || request.getFatG() == null || request.getFiberG() == null || request.getSodiumMg() == null
                    || request.getIngredients() == null || request.getIngredients().stream().noneMatch(value -> value != null && !value.isBlank())
                    || request.getSteps() == null || request.getSteps().stream().noneMatch(value -> value != null && !value.isBlank())) {
                throw new BadRequestException("Vui lòng nhập đầy đủ thông tin công thức hiển thị ở trang chi tiết");
            }
            if ("VIDEO".equalsIgnoreCase(contentType) && (request.getMediaUrl() == null || request.getMediaUrl().isBlank())) {
                throw new BadRequestException("Vui lòng tải tệp video MP4");
            }
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
                .prepTimeMin(content.getPrepTimeMin())
                .cookTimeMin(content.getCookTimeMin())
                .servings(content.getServings())
                .calories(content.getCalories())
                .proteinG(content.getProteinG())
                .carbsG(content.getCarbsG())
                .fatG(content.getFatG())
                .fiberG(content.getFiberG())
                .sodiumMg(content.getSodiumMg())
                .ingredients(readList(content.getIngredientsJson()))
                .steps(readList(content.getStepsJson()))
                .status(content.getStatus())
                .viewCount(content.getViewCount())
                .createdAt(content.getCreatedAt())
                .updatedAt(content.getUpdatedAt())
                .build();
    }

    private String writeList(List<String> values) {
        if (values == null) return null;
        try { return JSON.writeValueAsString(values.stream().filter(value -> value != null && !value.isBlank()).map(String::trim).toList()); }
        catch (Exception ex) { throw new BadRequestException("Danh sách công thức không hợp lệ"); }
    }

    private List<String> readList(String value) {
        if (value == null || value.isBlank()) return List.of();
        try { return JSON.readValue(value, new TypeReference<List<String>>() {}); }
        catch (Exception ex) { log.warn("Không thể đọc dữ liệu danh sách của bài viết"); return List.of(); }
    }
}
