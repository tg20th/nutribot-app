package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.AuthorRecipeSuggestionResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestion;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.ContentRecipeSuggestionRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * NB-84: Tac gia theo doi trang thai de xuat cong thuc cua chinh bai viet cua minh.
 * <p>
 * Tac giả khong can vao trang quan tri de biet bai viet da duoc duyet hay bi tu choi,
 * va biet chinh xac ly do khi bi tu choi.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthorRecipeSuggestionService {

    private static final int MAX_PAGE_SIZE = 50;

    private final ContentRecipeSuggestionRepository suggestionRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public PagedResponse<AuthorRecipeSuggestionResponse> listMySuggestions(
            String username, String status, int page, int size) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Người dùng không tồn tại"));

        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<ContentRecipeSuggestion> result;
        if (status == null || status.isBlank()) {
            result = suggestionRepository.findByContentUserUserId(user.getUserId(), pageable);
        } else {
            result = suggestionRepository.findByContentUserUserIdAndStatusIn(
                    user.getUserId(), List.of(status.trim().toUpperCase()), pageable);
        }

        Map<Integer, String> reviewerNames = resolveReviewerNames(result.getContent());
        return PagedResponse.of(result.map(suggestion -> toResponse(suggestion, reviewerNames)));
    }

    @Transactional(readOnly = true)
    public AuthorRecipeSuggestionResponse getMySuggestion(String username, Integer suggestionId) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Người dùng không tồn tại"));
        ContentRecipeSuggestion suggestion = suggestionRepository
                .findBySuggestionIdAndContentUserUserId(suggestionId, user.getUserId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy đề xuất với ID: " + suggestionId));
        return toResponse(suggestion, resolveReviewerNames(List.of(suggestion)));
    }

    private Map<Integer, String> resolveReviewerNames(List<ContentRecipeSuggestion> suggestions) {
        List<Integer> reviewerIds = suggestions.stream()
                .map(ContentRecipeSuggestion::getReviewedBy)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (reviewerIds.isEmpty()) {
            return Map.of();
        }
        Map<Integer, String> names = new HashMap<>();
        for (User user : userRepository.findAllById(reviewerIds)) {
            names.put(user.getUserId(), user.getFullName());
        }
        return names;
    }

    private AuthorRecipeSuggestionResponse toResponse(
            ContentRecipeSuggestion suggestion, Map<Integer, String> reviewerNames) {
        Content content = suggestion.getContent();
        Integer reviewedBy = suggestion.getReviewedBy();
        return AuthorRecipeSuggestionResponse.builder()
                .suggestionId(suggestion.getSuggestionId())
                .status(suggestion.getStatus())
                .dishName(suggestion.getDishName())
                .recipeTitle(suggestion.getRecipeTitle())
                .contentId(content != null ? content.getContentId() : null)
                .contentTitle(content != null ? content.getTitle() : null)
                .contentType(content != null ? content.getContentType() : null)
                .sourceViewCount(suggestion.getSourceViewCount())
                .sourceVoteCount(suggestion.getSourceVoteCount())
                .rejectionReason(suggestion.getRejectionReason())
                .reviewedBy(reviewedBy)
                .reviewedByName(reviewedBy != null ? reviewerNames.get(reviewedBy) : null)
                .reviewedAt(suggestion.getReviewedAt())
                .createdAt(suggestion.getCreatedAt())
                .updatedAt(suggestion.getUpdatedAt())
                .build();
    }
}
