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
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ContentService {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final ContentRepository contentRepository;

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
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(50, size));
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt", "contentId"));
        Page<Content> contentPage = contentRepository.findPublishedByType(VIDEO_TYPE, PUBLISHED_STATUS, pageable);
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

    // ==================== MAPPERS ====================

    private ContentListResponse toBlogListResponse(Content content) {
        return ContentListResponse.builder()
                .contentId(content.getContentId())
                .title(content.getTitle())
                .slug(content.getSlug())
                .thumbnailUrl(content.getThumbnailUrl())
                .categoryId(content.getCategoryId())
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
                .categoryId(content.getCategoryId())
                .prepTimeMin(content.getPrepTimeMin()).cookTimeMin(content.getCookTimeMin()).servings(content.getServings())
                .calories(content.getCalories()).proteinG(content.getProteinG()).carbsG(content.getCarbsG()).fatG(content.getFatG())
                .fiberG(content.getFiberG()).sodiumMg(content.getSodiumMg()).ingredients(readList(content.getIngredientsJson())).steps(readList(content.getStepsJson()))
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
                .categoryId(content.getCategoryId())
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
                .categoryId(content.getCategoryId())
                .prepTimeMin(content.getPrepTimeMin()).cookTimeMin(content.getCookTimeMin()).servings(content.getServings())
                .calories(content.getCalories()).proteinG(content.getProteinG()).carbsG(content.getCarbsG()).fatG(content.getFatG())
                .fiberG(content.getFiberG()).sodiumMg(content.getSodiumMg()).ingredients(readList(content.getIngredientsJson())).steps(readList(content.getStepsJson()))
                .authorId(content.getUser().getUserId())
                .authorName(content.getUser().getFullName())
                .viewCount(content.getViewCount())
                .voteCount(0)
                .userVoted(userVoted)
                .createdAt(content.getCreatedAt())
                .build();
    }

    private List<String> readList(String value) {
        if (value == null || value.isBlank()) return List.of();
        try { return JSON.readValue(value, new TypeReference<List<String>>() {}); }
        catch (Exception ex) { return List.of(); }
    }
}
