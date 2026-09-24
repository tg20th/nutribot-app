package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.CategoryResponse;
import com.fpt.swp391.nutribot.dto.response.ContentListResponse;
import com.fpt.swp391.nutribot.dto.response.HomeSummaryResponse;
import com.fpt.swp391.nutribot.entity.Category;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.repository.CategoryRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HomeService {

    private final ContentRepository contentRepository;
    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;

    private static final String BLOG_TYPE = "BLOG";
    private static final String VIDEO_TYPE = "VIDEO";
    private static final String PUBLISHED_STATUS = "published";

    @Transactional(readOnly = true)
    public HomeSummaryResponse getHomeSummary() {
        List<Content> featuredBlogs = contentRepository.findPublishedByTypeWithLimit(
                BLOG_TYPE, PUBLISHED_STATUS, PageRequest.of(0, 6));

        List<Content> latestVideos = contentRepository.findPublishedByTypeWithLimit(
                VIDEO_TYPE, PUBLISHED_STATUS, PageRequest.of(0, 6));

        List<Category> categories = categoryRepository.findRootCategories();

        Long totalBlogs = contentRepository.countByContentTypeAndStatus(BLOG_TYPE, PUBLISHED_STATUS);
        Long totalVideos = contentRepository.countByContentTypeAndStatus(VIDEO_TYPE, PUBLISHED_STATUS);
        Long totalUsers = userRepository.count();

        return HomeSummaryResponse.builder()
                .featuredBlogs(featuredBlogs.stream().map(this::toContentListResponse).collect(Collectors.toList()))
                .latestVideos(latestVideos.stream().map(this::toContentListResponse).collect(Collectors.toList()))
                .categories(categories.stream().map(this::toCategoryResponse).collect(Collectors.toList()))
                .stats(HomeSummaryResponse.StatsResponse.builder()
                        .totalBlogs(totalBlogs)
                        .totalVideos(totalVideos)
                        .totalUsers(totalUsers)
                        .build())
                .build();
    }

    private ContentListResponse toContentListResponse(Content content) {
        return ContentListResponse.builder()
                .contentId(content.getContentId())
                .title(content.getTitle())
                .slug(content.getSlug())
                .thumbnailUrl(content.getThumbnailUrl())
                .authorName(content.getUser() != null ? content.getUser().getFullName() : null)
                .viewCount(content.getViewCount())
                .voteCount(0)
                .createdAt(content.getCreatedAt())
                .build();
    }

    private CategoryResponse toCategoryResponse(Category category) {
        return CategoryResponse.builder()
                .categoryId(category.getCategoryId())
                .categoryName(category.getCategoryName())
                .slug(category.getSlug())
                .iconUrl(category.getIconUrl())
                .contentCount(0L)
                .build();
    }
}
