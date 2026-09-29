package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.*;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ContentService {

    private final ContentRepository contentRepository;
    private final com.fpt.swp391.nutribot.repository.VoteRepository voteRepository;

    private static final String BLOG_TYPE = "BLOG";
    private static final String VIDEO_TYPE = "VIDEO";
    private static final String PUBLISHED_STATUS = "published";

    // ==================== BLOG METHODS ====================

    @Transactional(readOnly = true)
    public PagedResponse<ContentListResponse> getPublishedBlogs(int page, int size, Integer categoryId) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(50, size));
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt", "contentId"));
        Page<Content> contentPage = categoryId == null
                ? contentRepository.findPublishedByType(BLOG_TYPE, PUBLISHED_STATUS, pageable)
                : contentRepository.findPublishedByTypeAndCategory(BLOG_TYPE, categoryId, PUBLISHED_STATUS, pageable);
        Page<ContentListResponse> responsePage = contentPage.map(this::toBlogListResponse);
        return PagedResponse.of(responsePage);
    }

    @Transactional
    public ContentDetailResponse getBlogBySlug(String slug) {
        Content content = contentRepository.findPublishedBySlugAndType(slug, BLOG_TYPE, PUBLISHED_STATUS)
                .orElseThrow(() -> new NotFoundException("Bài viết không tồn tại"));

        contentRepository.incrementViewCount(content.getContentId());
        content.setViewCount(content.getViewCount() + 1);

        return toBlogDetailResponse(content, null);
    }

    @Transactional
    public ContentDetailResponse getBlogById(Integer id) {
        Content content = contentRepository.findPublishedByIdAndType(id, BLOG_TYPE, PUBLISHED_STATUS)
                .orElseThrow(() -> new NotFoundException("Bài viết không tồn tại"));

        contentRepository.incrementViewCount(content.getContentId());
        content.setViewCount(content.getViewCount() + 1);

        return toBlogDetailResponse(content, null);
    }

    // ==================== VIDEO METHODS ====================

    @Transactional(readOnly = true)
    public PagedResponse<VideoListResponse> getPublishedVideos(int page, int size) {
        return getPublishedVideos(page, size, null);
    }

    @Transactional(readOnly = true)
    public PagedResponse<VideoListResponse> getPublishedVideos(int page, int size, Integer categoryId) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(50, size));
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt", "contentId"));
        Page<Content> contentPage = categoryId == null
                ? contentRepository.findPublishedByType(VIDEO_TYPE, PUBLISHED_STATUS, pageable)
                : contentRepository.findPublishedByTypeAndCategory(VIDEO_TYPE, categoryId, PUBLISHED_STATUS, pageable);
        Page<VideoListResponse> responsePage = contentPage.map(this::toVideoListResponse);
        return PagedResponse.of(responsePage);
    }

    @Transactional
    public VideoDetailResponse getVideoBySlug(String slug) {
        Content content = contentRepository.findPublishedBySlugAndType(slug, VIDEO_TYPE, PUBLISHED_STATUS)
                .orElseThrow(() -> new NotFoundException("Video không tồn tại"));

        contentRepository.incrementViewCount(content.getContentId());
        content.setViewCount(content.getViewCount() + 1);

        return toVideoDetailResponse(content, null);
    }

    @Transactional
    public VideoDetailResponse getVideoById(Integer id) {
        Content content = contentRepository.findPublishedByIdAndType(id, VIDEO_TYPE, PUBLISHED_STATUS)
                .orElseThrow(() -> new NotFoundException("Video không tồn tại"));

        contentRepository.incrementViewCount(content.getContentId());
        content.setViewCount(content.getViewCount() + 1);

        return toVideoDetailResponse(content, null);
    }

    @Transactional
    public VideoDetailResponse getVideoByIdOrSlug(String slugOrId) {
        if (slugOrId == null || slugOrId.isBlank()) {
            throw new NotFoundException("Video không tồn tại");
        }
        if (slugOrId.matches("^\\d+$")) {
            try {
                return getVideoById(Integer.parseInt(slugOrId));
            } catch (NumberFormatException ignored) {
            }
        }
        return getVideoBySlug(slugOrId);
    }

    // ==================== MAPPERS ====================

    private int getVoteCount(Integer contentId) {
        if (voteRepository == null || contentId == null) {
            return 0;
        }
        try {
            Long count = voteRepository.countByContentId(contentId);
            return count != null ? count.intValue() : 0;
        } catch (Exception ignored) {
            return 0;
        }
    }

    private ContentListResponse toBlogListResponse(Content content) {
        return ContentListResponse.builder()
                .contentId(content.getContentId())
                .title(content.getTitle())
                .slug(content.getSlug())
                .thumbnailUrl(content.getThumbnailUrl())
                .categoryId(content.getCategoryId())
                .authorName(content.getUser() != null ? content.getUser().getFullName() : null)
                .viewCount(content.getViewCount())
                .voteCount(getVoteCount(content.getContentId()))
                .createdAt(content.getCreatedAt())
                .build();
    }

    private ContentDetailResponse toBlogDetailResponse(Content content, Boolean userVoted) {
        return ContentDetailResponse.builder()
                .contentId(content.getContentId())
                .title(content.getTitle())
                .body(content.getBody())
                .thumbnailUrl(content.getThumbnailUrl())
                .categoryId(content.getCategoryId())
                .authorId(content.getUser() != null ? content.getUser().getUserId() : null)
                .authorName(content.getUser() != null ? content.getUser().getFullName() : null)
                .viewCount(content.getViewCount())
                .voteCount(getVoteCount(content.getContentId()))
                .userVoted(userVoted)
                .createdAt(content.getCreatedAt())
                .build();
    }

    private VideoListResponse toVideoListResponse(Content content) {
        return VideoListResponse.builder()
                .contentId(content.getContentId())
                .title(content.getTitle())
                .slug(content.getSlug())
                .thumbnailUrl(content.getThumbnailUrl())
                .mediaUrl(content.getMediaUrl())
                .durationSec(content.getDurationSec())
                .categoryId(content.getCategoryId())
                .authorName(content.getUser() != null ? content.getUser().getFullName() : null)
                .viewCount(content.getViewCount())
                .voteCount(getVoteCount(content.getContentId()))
                .createdAt(content.getCreatedAt())
                .build();
    }

    private VideoDetailResponse toVideoDetailResponse(Content content, Boolean userVoted) {
        return VideoDetailResponse.builder()
                .contentId(content.getContentId())
                .title(content.getTitle())
                .body(content.getBody())
                .mediaUrl(content.getMediaUrl())
                .thumbnailUrl(content.getThumbnailUrl())
                .durationSec(content.getDurationSec())
                .categoryId(content.getCategoryId())
                .authorId(content.getUser() != null ? content.getUser().getUserId() : null)
                .authorName(content.getUser() != null ? content.getUser().getFullName() : null)
                .viewCount(content.getViewCount())
                .voteCount(getVoteCount(content.getContentId()))
                .userVoted(userVoted)
                .createdAt(content.getCreatedAt())
                .build();
    }
}
