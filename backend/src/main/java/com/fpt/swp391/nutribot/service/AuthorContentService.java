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

        if (request.getCategoryId() != null) {
            validateCategory(request.getCategoryId());
        }

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
                .status(STATUS_DRAFT) // Bài viết mới tạo luôn là draft
                .viewCount(0)
                .build();

        Content saved = contentRepository.save(content);
        return toAuthorResponse(saved);
    }

    @Transactional(readOnly = true)
    public AuthorContentResponse getContentById(String username, Integer contentId) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new NotFoundException("Bài viết không tồn tại"));

        if (!content.getUser().getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền xem nội dung này");
        }

        return toAuthorResponse(content);
    }

    @Transactional
    public AuthorContentResponse updateContent(String username, Integer contentId, ContentUpdateRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new NotFoundException("Bài viết không tồn tại"));

        if (!content.getUser().getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa nội dung này");
        }

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
                log.info("Bài viết {} đang ở trạng thái {}, tác giả cập nhật nội dung -> tự động hạ về DRAFT", contentId, content.getStatus());
                content.setStatus(STATUS_DRAFT);
            }
        }

        Content saved = contentRepository.save(content);
        return toAuthorResponse(saved);
    }

    @Transactional
    public AuthorContentResponse submitContent(String username, Integer contentId) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new NotFoundException("Bài viết không tồn tại"));

        if (!content.getUser().getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền thao tác trên bài viết này");
        }

        content.setStatus(STATUS_UNDER_REVIEW);
        Content saved = contentRepository.save(content);
        log.info("Tác giả {} đã nộp bài viết {} sang trạng thái {}", username, contentId, STATUS_UNDER_REVIEW);
        return toAuthorResponse(saved);
    }

    @Transactional
    public AuthorContentResponse recallContent(String username, Integer contentId) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new NotFoundException("Bài viết không tồn tại"));

        if (!content.getUser().getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền thao tác trên bài viết này");
        }

        content.setStatus(STATUS_DRAFT);
        Content saved = contentRepository.save(content);
        log.info("Tác giả {} đã rút bài viết {} về trạng thái {}", username, contentId, STATUS_DRAFT);
        return toAuthorResponse(saved);
    }

    @Transactional
    public void deleteContent(String username, Integer contentId) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new NotFoundException("Bài viết không tồn tại"));

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

    private void validateCategory(Integer categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new BadRequestException("Danh mục không tồn tại"));

        if (!Boolean.TRUE.equals(category.getActive())) {
            throw new BadRequestException("Danh mục hiện đang bị vô hiệu hóa");
        }

        if (category.getCategoryType() == null || !category.getCategoryType().equalsIgnoreCase("RECIPE")) {
            throw new BadRequestException("Danh mục không hợp lệ hoặc không hỗ trợ bài viết blog");
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
                .status(content.getStatus())
                .viewCount(content.getViewCount())
                .createdAt(content.getCreatedAt())
                .updatedAt(content.getUpdatedAt())
                .build();
    }
}
