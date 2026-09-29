package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.ContentListResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class SearchService {

    private final ContentRepository contentRepository;

    private static final String PUBLISHED_STATUS = "published";

    @Transactional(readOnly = true)
    public PagedResponse<ContentListResponse> search(String keyword, Integer categoryId, String contentType, int page, int size) {
        return search(keyword, categoryId, contentType, "newest", page, size);
    }

    @Transactional(readOnly = true)
    public PagedResponse<ContentListResponse> search(String keyword, Integer categoryId, String contentType, String sort, int page, int size) {
        int validPage = Math.max(0, page);
        int validSize = Math.min(Math.max(1, size), 50);

        String cleanKeyword = (keyword != null && !keyword.trim().isEmpty()) ? keyword.trim() : null;

        String cleanType = null;
        if (contentType != null && !contentType.isBlank()) {
            String upper = contentType.trim().toUpperCase(java.util.Locale.ROOT);
            if ("BLOG".equals(upper) || "VIDEO".equals(upper)) {
                cleanType = upper;
            }
        }

        Sort sortObj;
        String sortOption = (sort != null) ? sort.trim().toLowerCase(java.util.Locale.ROOT) : "newest";
        switch (sortOption) {
            case "popular":
            case "views":
                sortObj = Sort.by(Sort.Order.desc("viewCount"), Sort.Order.desc("createdAt"), Sort.Order.desc("contentId"));
                break;
            case "oldest":
                sortObj = Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("contentId"));
                break;
            case "newest":
            default:
                sortObj = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("contentId"));
                break;
        }

        Pageable pageable = PageRequest.of(validPage, validSize, sortObj);
        Page<Content> contentPage;

        if (cleanKeyword != null) {
            String searchKeyword = "%" + cleanKeyword.toLowerCase(java.util.Locale.ROOT) + "%";
            if (cleanType != null && categoryId != null) {
                contentPage = contentRepository.searchByKeywordAndTypeAndCategory(searchKeyword, cleanType, categoryId, PUBLISHED_STATUS, pageable);
            } else if (cleanType != null) {
                contentPage = contentRepository.searchByKeywordAndType(searchKeyword, cleanType, PUBLISHED_STATUS, pageable);
            } else if (categoryId != null) {
                contentPage = contentRepository.searchByKeywordAndCategory(searchKeyword, categoryId, PUBLISHED_STATUS, pageable);
            } else {
                contentPage = contentRepository.searchByKeyword(searchKeyword, PUBLISHED_STATUS, pageable);
            }
        } else if (cleanType != null && categoryId != null) {
            contentPage = contentRepository.findPublishedByTypeAndCategory(cleanType, categoryId, PUBLISHED_STATUS, pageable);
        } else if (cleanType != null) {
            contentPage = contentRepository.findPublishedByType(cleanType, PUBLISHED_STATUS, pageable);
        } else if (categoryId != null) {
            contentPage = contentRepository.findPublishedByCategory(categoryId, PUBLISHED_STATUS, pageable);
        } else {
            contentPage = contentRepository.findPublishedAll(PUBLISHED_STATUS, pageable);
        }

        Page<ContentListResponse> responsePage = contentPage.map(this::toContentListResponse);
        return PagedResponse.of(responsePage);
    }

    private ContentListResponse toContentListResponse(Content content) {
        String avatar = content.getUser() != null ? content.getUser().getAvatarUrl() : null;
        return ContentListResponse.builder()
                .contentId(content.getContentId())
                .title(content.getTitle())
                .slug(content.getSlug())
                .thumbnailUrl(content.getThumbnailUrl())
                .categoryId(content.getCategoryId())
                .authorId(content.getUser() != null ? content.getUser().getUserId() : null)
                .authorUsername(content.getUser() != null ? content.getUser().getUsername() : null)
                .authorName(content.getUser() != null ? content.getUser().getFullName() : null)
                .authorAvatar(avatar)
                .avatarUrl(avatar)
                .viewCount(content.getViewCount())
                .voteCount(0)
                .createdAt(content.getCreatedAt())
                .build();
    }
}
