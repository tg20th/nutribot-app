package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.ContentCreateRequest;
import com.fpt.swp391.nutribot.dto.request.ContentUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.AuthorContentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.ForbiddenException;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthorContentService {

    private final ContentRepository contentRepository;
    private final UserRepository userRepository;

    private static final String BLOG_TYPE = "BLOG";
    private static final String VIDEO_TYPE = "VIDEO";
    private static final List<String> VALID_STATUSES = List.of("draft", "under_review", "published", "flagged", "archived");

    @Transactional(readOnly = true)
    public PagedResponse<AuthorContentResponse> getMyContent(String username, String contentType, int page, int size) {
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

        Content content = Content.builder()
                .user(user)
                .contentType(contentType)
                .title(request.getTitle())
                .slug(generateSlug(request.getTitle()))
                .body(request.getBody())
                .mediaUrl(request.getMediaUrl())
                .thumbnailUrl(request.getThumbnailUrl())
                .durationSec(request.getDurationSec())
                .status("draft")
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
                .orElseThrow(() -> new BadRequestException("Nội dung không tồn tại"));

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
                .orElseThrow(() -> new BadRequestException("Nội dung không tồn tại"));

        if (!content.getUser().getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa nội dung này");
        }

        if (request.getTitle() != null) {
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
            content.setThumbnailUrl(request.getThumbnailUrl());
        }
        if (request.getDurationSec() != null) {
            content.setDurationSec(request.getDurationSec());
        }
        if (request.getStatus() != null) {
            if (!VALID_STATUSES.contains(request.getStatus())) {
                throw new BadRequestException("Trạng thái không hợp lệ");
            }
            content.setStatus(request.getStatus());
        }

        Content saved = contentRepository.save(content);
        return toAuthorResponse(saved);
    }

    @Transactional
    public void deleteContent(String username, Integer contentId) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new BadRequestException("Nội dung không tồn tại"));

        if (!content.getUser().getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền xóa nội dung này");
        }

        contentRepository.delete(content);
    }

    private String generateSlug(String title) {
        String slug = title.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .trim();
        return slug + "-" + System.currentTimeMillis();
    }

    private AuthorContentResponse toAuthorResponse(Content content) {
        return AuthorContentResponse.builder()
                .contentId(content.getContentId())
                .contentType(content.getContentType())
                .title(content.getTitle())
                .slug(content.getSlug())
                .body(content.getBody())
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
