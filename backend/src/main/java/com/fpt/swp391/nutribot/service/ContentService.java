package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.*;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.exception.BadRequestException;
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

    private static final String BLOG_TYPE = "BLOG";
    private static final String VIDEO_TYPE = "VIDEO";
    private static final String PUBLISHED_STATUS = "published";

    // ==================== BLOG METHODS ====================

    @Transactional(readOnly = true)
    public PagedResponse<ContentListResponse> getPublishedBlogs(int page, int size, Integer categoryId) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Content> contentPage = contentRepository.findByContentTypeAndStatus(BLOG_TYPE, PUBLISHED_STATUS, pageable);
        Page<ContentListResponse> responsePage = contentPage.map(this::toBlogListResponse);
        return PagedResponse.of(responsePage);
    }

    @Transactional(readOnly = true)
    public ContentDetailResponse getBlogBySlug(String slug) {
        Content content = contentRepository.findBySlug(slug)
                .orElseThrow(() -> new BadRequestException("Bài viết không tồn tại"));

        if (!BLOG_TYPE.equals(content.getContentType())) {
            throw new BadRequestException("Bài viết không tồn tại");
        }

        if (!PUBLISHED_STATUS.equals(content.getStatus())) {
            throw new BadRequestException("Bài viết không khả dụng");
        }

        contentRepository.incrementViewCount(content.getContentId());
        content.setViewCount(content.getViewCount() + 1);

        return toBlogDetailResponse(content, null);
    }

    @Transactional(readOnly = true)
    public ContentDetailResponse getBlogById(Integer id) {
        Content content = contentRepository.findByContentIdAndType(id, BLOG_TYPE)
                .orElseThrow(() -> new BadRequestException("Bài viết không tồn tại"));

        if (!PUBLISHED_STATUS.equals(content.getStatus())) {
            throw new BadRequestException("Bài viết không khả dụng");
        }

        contentRepository.incrementViewCount(content.getContentId());
        content.setViewCount(content.getViewCount() + 1);

        return toBlogDetailResponse(content, null);
    }

    // ==================== VIDEO METHODS ====================

    @Transactional(readOnly = true)
    public PagedResponse<VideoListResponse> getPublishedVideos(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Content> contentPage = contentRepository.findByContentTypeAndStatus(VIDEO_TYPE, PUBLISHED_STATUS, pageable);
        Page<VideoListResponse> responsePage = contentPage.map(this::toVideoListResponse);
        return PagedResponse.of(responsePage);
    }

    @Transactional(readOnly = true)
    public VideoDetailResponse getVideoBySlug(String slug) {
        Content content = contentRepository.findBySlug(slug)
                .orElseThrow(() -> new BadRequestException("Video không tồn tại"));

        if (!VIDEO_TYPE.equals(content.getContentType())) {
            throw new BadRequestException("Video không tồn tại");
        }

        if (!PUBLISHED_STATUS.equals(content.getStatus())) {
            throw new BadRequestException("Video không khả dụng");
        }

        contentRepository.incrementViewCount(content.getContentId());
        content.setViewCount(content.getViewCount() + 1);

        return toVideoDetailResponse(content, null);
    }

    @Transactional(readOnly = true)
    public VideoDetailResponse getVideoById(Integer id) {
        Content content = contentRepository.findByContentIdAndType(id, VIDEO_TYPE)
                .orElseThrow(() -> new BadRequestException("Video không tồn tại"));

        if (!PUBLISHED_STATUS.equals(content.getStatus())) {
            throw new BadRequestException("Video không khả dụng");
        }

        contentRepository.incrementViewCount(content.getContentId());
        content.setViewCount(content.getViewCount() + 1);

        return toVideoDetailResponse(content, null);
    }

    // ==================== MAPPERS ====================

    private ContentListResponse toBlogListResponse(Content content) {
        return ContentListResponse.builder()
                .contentId(content.getContentId())
                .title(content.getTitle())
                .slug(content.getSlug())
                .thumbnailUrl(content.getThumbnailUrl())
                .authorName(content.getUser().getFullName())
                .viewCount(content.getViewCount())
                .voteCount(0)
                .createdAt(content.getCreatedAt())
                .build();
    }

    private ContentDetailResponse toBlogDetailResponse(Content content, Boolean userVoted) {
        return ContentDetailResponse.builder()
                .contentId(content.getContentId())
                .title(content.getTitle())
                .body(content.getBody())
                .thumbnailUrl(content.getThumbnailUrl())
                .authorId(content.getUser().getUserId())
                .authorName(content.getUser().getFullName())
                .viewCount(content.getViewCount())
                .voteCount(0)
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
                .authorName(content.getUser().getFullName())
                .viewCount(content.getViewCount())
                .voteCount(0)
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
                .authorId(content.getUser().getUserId())
                .authorName(content.getUser().getFullName())
                .viewCount(content.getViewCount())
                .voteCount(0)
                .userVoted(userVoted)
                .createdAt(content.getCreatedAt())
                .build();
    }
}
