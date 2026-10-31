package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.ContentListResponse;
import com.fpt.swp391.nutribot.dto.response.MyRecipeResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.dto.response.PublicProfileStats;
import com.fpt.swp391.nutribot.dto.response.PublicUserProfileResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.Dish;
import com.fpt.swp391.nutribot.entity.Recipe;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.RecipeRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class PublicProfileService {

    private final UserRepository userRepository;
    private final ContentRepository contentRepository;
    private final RecipeRepository recipeRepository;
    private final RecipeResponseMapper recipeResponseMapper;
    private final com.fpt.swp391.nutribot.repository.VoteRepository voteRepository;

    private static final String PUBLISHED_STATUS = "published";
    private static final String VERIFIED_RECIPE_STATUS = "verified";
    private static final String BLOG_TYPE = "BLOG";
    private static final String VIDEO_TYPE = "VIDEO";

    @Transactional(readOnly = true)
    public PublicUserProfileResponse getPublicProfile(String username) {
        User user = lookupActiveUser(username);

        long blogCount = contentRepository.countByContentTypeAndStatusAndUserUserId(BLOG_TYPE, PUBLISHED_STATUS, user.getUserId());
        long videoCount = contentRepository.countByContentTypeAndStatusAndUserUserId(VIDEO_TYPE, PUBLISHED_STATUS, user.getUserId());
        long recipeCount = recipeRepository.countBySourceUserIdAndStatus(user.getUserId(), VERIFIED_RECIPE_STATUS);

        PublicProfileStats stats = PublicProfileStats.builder()
                .publishedBlogCount(blogCount)
                .publishedVideoCount(videoCount)
                .verifiedRecipeCount(recipeCount)
                .totalContributions(blogCount + videoCount + recipeCount)
                .build();

        String roleName = user.getRole() != null ? user.getRole().getRoleName() : null;
        if (roleName != null && roleName.toUpperCase(Locale.ROOT).startsWith("ROLE_")) {
            roleName = roleName.substring(5);
        }

        return PublicUserProfileResponse.builder()
                .userId(user.getUserId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .bio(user.getBio())
                .role(roleName)
                .joinedAt(user.getCreatedAt())
                .stats(stats)
                .build();
    }

    @Transactional(readOnly = true)
    public PagedResponse<ContentListResponse> getPublicPosts(String username, String contentType, int page, int size) {
        User user = lookupActiveUser(username);

        String normalizedType = normalizeContentType(contentType);
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(50, size));
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt", "contentId"));

        Page<Content> contentPage = contentRepository
                .findByContentTypeAndStatusAndUserUserId(normalizedType, PUBLISHED_STATUS, user.getUserId(), pageable);

        Page<ContentListResponse> responsePage = contentPage.map(this::toListResponse);
        return PagedResponse.of(responsePage);
    }

    @Transactional(readOnly = true)
    public List<MyRecipeResponse> getPublicRecipes(String username) {
        User user = lookupActiveUser(username);

        List<Recipe> recipes = recipeRepository
                .findBySourceUserIdAndStatusOrderByCreatedAtDesc(user.getUserId(), VERIFIED_RECIPE_STATUS);
        if (recipes == null || recipes.isEmpty()) {
            return List.of();
        }

        return recipes.stream()
                .map(recipeResponseMapper::toResponse)
                .filter(Objects::nonNull)
                .toList();
    }

    private User lookupActiveUser(String identifier) {
        // FE truyền userId số (UserProfileLink, CommunityPostCard) hoặc username — hỗ trợ cả hai
        if (identifier != null && identifier.matches("\\d+")) {
            Integer userId = Integer.valueOf(identifier.trim());
            return userRepository.findById(userId)
                    .filter(user -> AccountStatus.canAccessSystem(user.getStatus()))
                    .orElseThrow(() -> new NotFoundException("Người dùng không tồn tại"));
        }
        return userRepository.findByUsernameIgnoreCaseAndStatus(identifier, AccountStatus.ACTIVE)
                .or(() -> userRepository.findByUsernameIgnoreCase(identifier)
                        .filter(user -> AccountStatus.canAccessSystem(user.getStatus())))
                .orElseThrow(() -> new NotFoundException("Người dùng không tồn tại"));
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            throw new BadRequestException("Loại nội dung không hợp lệ");
        }
        String upper = contentType.trim().toUpperCase(Locale.ROOT);
        if (!BLOG_TYPE.equals(upper) && !VIDEO_TYPE.equals(upper)) {
            throw new BadRequestException("Loại nội dung không hợp lệ");
        }
        return upper;
    }

    private ContentListResponse toListResponse(Content content) {
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
                .voteCount(getVoteCount(content.getContentId()))
                .createdAt(content.getCreatedAt())
                .build();
    }

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
}
