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
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<Content> contentPage;

        if (StringUtils.hasText(keyword)) {
            String searchKeyword = "%" + keyword.toLowerCase() + "%";
            if (StringUtils.hasText(contentType)) {
                contentPage = contentRepository.searchByKeywordAndType(searchKeyword, contentType.toUpperCase(), PUBLISHED_STATUS, pageable);
            } else {
                contentPage = contentRepository.searchByKeyword(searchKeyword, PUBLISHED_STATUS, pageable);
            }
        } else if (StringUtils.hasText(contentType)) {
            contentPage = contentRepository.findByContentTypeAndStatus(contentType.toUpperCase(), PUBLISHED_STATUS, pageable);
        } else {
            contentPage = contentRepository.findByStatus(PUBLISHED_STATUS, pageable);
        }

        Page<ContentListResponse> responsePage = contentPage.map(this::toContentListResponse);
        return PagedResponse.of(responsePage);
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
}
