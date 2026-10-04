package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.request.RecommendationRequestDto;
import com.fpt.swp391.nutribot.dto.response.PersonalizedFeedResponse;
import com.fpt.swp391.nutribot.dto.response.RecommendationResponseDto;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.entity.Vote;
import com.fpt.swp391.nutribot.exception.AIServiceUnavailableException;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.repository.VoteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PersonalizedFeedService {

    private static final String BLOG_TYPE = "BLOG";
    private static final String VIDEO_TYPE = "VIDEO";
    private static final String PUBLISHED_STATUS = "published";
    private static final int MAX_CATALOG_SIZE = 5000;
    private static final int MAX_INTERACTIONS = 1000;

    private final ContentRepository contentRepository;
    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final VoteRepository voteRepository;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    @Value("${ai-service.base-url:http://localhost:8000}")
    private String aiServiceBaseUrl;

    @Value("${ai-service.timeout-seconds:35}")
    private int aiServiceTimeoutSeconds;

    @Transactional(readOnly = true)
    public PersonalizedFeedResponse getPersonalizedFeed(String username, Integer limit, String cursor) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<Content> catalog = fetchPublicCatalog();
        String vegetarianType = fetchVegetarianType(user);
        List<RecommendationRequestDto.InteractionDto> interactions = fetchInteractions(user.getUserId());

        int effectiveLimit = Math.min(Math.max(limit != null ? limit : 20, 1), 50);

        RecommendationRequestDto request = buildRecommendationRequest(
                catalog, interactions, vegetarianType, effectiveLimit);

        RecommendationResponseDto aiResponse;
        boolean isFallback = false;

        try {
            aiResponse = callAiService(request);
        } catch (Exception e) {
            log.warn("AI service unavailable, using deterministic fallback: {}", e.getMessage());
            aiResponse = buildFallbackResponse(effectiveLimit);
            isFallback = true;
        }

        List<RecommendationResponseDto.RecommendationItemDto> rankedItems = aiResponse.getItems();
        if (rankedItems == null) {
            rankedItems = Collections.emptyList();
        }

        Set<Integer> seen = new LinkedHashSet<>();
        if (cursor != null && !cursor.isBlank()) {
            decodeCursorAndRemoveSeen(cursor, rankedItems, seen);
        }

        List<Integer> orderedIds = rankedItems.stream()
                .filter(item -> item.getContentId() != null)
                .map(RecommendationResponseDto.RecommendationItemDto::getContentId)
                .filter(seen::add)
                .limit(effectiveLimit)
                .collect(Collectors.toList());

        Map<Integer, String> idToReason = rankedItems.stream()
                .filter(item -> item.getContentId() != null)
                .collect(Collectors.toMap(
                        RecommendationResponseDto.RecommendationItemDto::getContentId,
                        RecommendationResponseDto.RecommendationItemDto::getReason,
                        (a, b) -> a
                ));

        List<Content> resolvedContents = hydrateContents(orderedIds);

        List<PersonalizedFeedResponse.FeedItemResponse> feedItems = resolvedContents.stream()
                .map(content -> toFeedItem(content, idToReason.get(content.getContentId())))
                .collect(Collectors.toList());

        String nextCursor = null;
        if (orderedIds.size() >= effectiveLimit && !seen.isEmpty()) {
            nextCursor = encodeCursor(seen);
        }

        return PersonalizedFeedResponse.builder()
                .items(feedItems)
                .nextCursor(nextCursor)
                .total(feedItems.size())
                .fallback(isFallback ? true : null)
                .build();
    }

    private List<Content> fetchPublicCatalog() {
        return contentRepository.findPublicCatalogForRecommendation(PUBLISHED_STATUS, PageRequest.of(0, MAX_CATALOG_SIZE));
    }

    private String fetchVegetarianType(User user) {
        return userProfileRepository.findById(user.getUserId())
                .map(UserProfile::getVegetarianType)
                .filter(vt -> vt != null && !vt.isBlank())
                .orElse(null);
    }

    private List<RecommendationRequestDto.InteractionDto> fetchInteractions(Integer userId) {
        List<Vote> votes = voteRepository.findByUserId(userId);
        return votes.stream()
                .filter(v -> v.getContentId() != null)
                .limit(MAX_INTERACTIONS)
                .map(vote -> RecommendationRequestDto.InteractionDto.builder()
                        .contentId(vote.getContentId())
                        .vote(vote.getVoteValue() != null ? vote.getVoteValue().intValue() : null)
                        .build())
                .collect(Collectors.toList());
    }

    private RecommendationRequestDto buildRecommendationRequest(
            List<Content> catalog,
            List<RecommendationRequestDto.InteractionDto> interactions,
            String vegetarianType,
            int limit) {

        List<RecommendationRequestDto.ContentCandidateDto> contentCandidates = catalog.stream()
                .map(this::toContentCandidate)
                .collect(Collectors.toList());

        return RecommendationRequestDto.builder()
                .contents(contentCandidates)
                .interactions(interactions)
                .vegetarianType(vegetarianType)
                .limit(limit)
                .build();
    }

    private RecommendationRequestDto.ContentCandidateDto toContentCandidate(Content content) {
        return RecommendationRequestDto.ContentCandidateDto.builder()
                .contentId(content.getContentId())
                .contentType(content.getContentType())
                .status(content.getStatus())
                .title(content.getTitle())
                .body(content.getBody())
                .description(content.getBody())
                .viewCount(content.getViewCount())
                .publishedAt(content.getCreatedAt() != null
                        ? content.getCreatedAt().toInstant(ZoneOffset.UTC).toString()
                        : null)
                .build();
    }

    private RecommendationResponseDto callAiService(RecommendationRequestDto request) {
        try {
            String requestBody = objectMapper.writeValueAsString(request);
            String responseBody = restClient.post()
                    .uri(aiServiceBaseUrl + "/api/ai/content-recommendations")
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);

            return objectMapper.readValue(responseBody, RecommendationResponseDto.class);
        } catch (Exception e) {
            throw new AIServiceUnavailableException("AI recommendation service failed: " + e.getMessage());
        }
    }

    private RecommendationResponseDto buildFallbackResponse(int limit) {
        List<Content> popularContent = contentRepository.findPublishedByTypeWithLimit(
                BLOG_TYPE, PUBLISHED_STATUS, PageRequest.of(0, limit / 2));
        List<Content> latestContent = contentRepository.findPublishedByTypeWithLimit(
                VIDEO_TYPE, PUBLISHED_STATUS, PageRequest.of(0, limit / 2));

        List<RecommendationResponseDto.RecommendationItemDto> items = new ArrayList<>();

        for (Content c : popularContent) {
            items.add(RecommendationResponseDto.RecommendationItemDto.builder()
                    .contentId(c.getContentId())
                    .contentType(c.getContentType())
                    .score(0.0)
                    .reason("cold_start")
                    .build());
        }

        for (Content c : latestContent) {
            items.add(RecommendationResponseDto.RecommendationItemDto.builder()
                    .contentId(c.getContentId())
                    .contentType(c.getContentType())
                    .score(0.0)
                    .reason("cold_start")
                    .build());
        }

        return RecommendationResponseDto.builder()
                .items(items)
                .embeddingModel("fallback")
                .build();
    }

    private List<Content> hydrateContents(List<Integer> orderedIds) {
        if (orderedIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<Content> contents = contentRepository.findAllById(orderedIds);

        Map<Integer, Content> contentMap = contents.stream()
                .filter(c -> PUBLISHED_STATUS.equalsIgnoreCase(c.getStatus()))
                .collect(Collectors.toMap(Content::getContentId, c -> c));

        return orderedIds.stream()
                .map(contentMap::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    private PersonalizedFeedResponse.FeedItemResponse toFeedItem(Content content, String reason) {
        String avatar = content.getUser() != null ? content.getUser().getAvatarUrl() : null;
        Long voteCount = contentRepository.countVoteByContentId(content.getContentId());

        return PersonalizedFeedResponse.FeedItemResponse.builder()
                .contentId(content.getContentId())
                .contentType(content.getContentType())
                .title(content.getTitle())
                .slug(content.getSlug())
                .thumbnailUrl(content.getThumbnailUrl())
                .categoryId(content.getCategoryId())
                .authorId(content.getUser() != null ? content.getUser().getUserId() : null)
                .authorUsername(content.getUser() != null ? content.getUser().getUsername() : null)
                .authorName(content.getUser() != null ? content.getUser().getFullName() : null)
                .authorAvatar(avatar)
                .viewCount(content.getViewCount())
                .voteCount(voteCount != null ? voteCount.intValue() : 0)
                .createdAt(content.getCreatedAt() != null
                        ? content.getCreatedAt().toInstant(ZoneOffset.UTC).toString()
                        : null)
                .recommendationReason(reason)
                .build();
    }

    private void decodeCursorAndRemoveSeen(String cursor, List<RecommendationResponseDto.RecommendationItemDto> rankedItems, Set<Integer> seen) {
        try {
            String decoded = new String(Base64.getDecoder().decode(cursor), StandardCharsets.UTF_8);
            String[] parts = decoded.split(",");
            for (String part : parts) {
                if (!part.isBlank()) {
                    seen.add(Integer.parseInt(part.trim()));
                }
            }

            rankedItems.removeIf(item -> item.getContentId() != null && seen.contains(item.getContentId()));
        } catch (Exception e) {
            log.warn("Failed to decode cursor: {}", cursor);
        }
    }

    private String encodeCursor(Set<Integer> seen) {
        String joined = seen.stream()
                .sorted()
                .map(String::valueOf)
                .collect(Collectors.joining(","));
        return Base64.getEncoder().encodeToString(joined.getBytes(StandardCharsets.UTF_8));
    }
}