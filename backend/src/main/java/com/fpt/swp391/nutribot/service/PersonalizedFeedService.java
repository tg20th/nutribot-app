package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.request.RecommendationRequestDto;
import com.fpt.swp391.nutribot.dto.response.PersonalizedFeedResponse;
import com.fpt.swp391.nutribot.dto.response.RecommendationResponseDto;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.entity.Vote;
import com.fpt.swp391.nutribot.exception.AIServiceUnavailableException;
import com.fpt.swp391.nutribot.exception.BadRequestException;
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
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class PersonalizedFeedService {

    private static final Pattern RECIPE_SECTION_BOUNDARY = Pattern.compile(
            "(?im)^\\s*##\\s*(?:recipe details|ingredients|steps)\\s*$|<h2[^>]*>\\s*(?:recipe details|ingredients|steps)\\s*</h2>");

    private static final String PUBLISHED_STATUS = "published";
    private static final int MAX_CATALOG_SIZE = 5000;
    private static final int MAX_INTERACTIONS = 1000;
    private static final int AI_RANKING_LIMIT = 50;
    private static final String CURSOR_SEPARATOR = ".";
    private static final long SNAPSHOT_TTL_SECONDS = 600;
    // A session remembers enough featured content for ten top-10 refreshes. It is
    // deliberately bounded: a finite catalog must eventually be allowed to repeat.
    private static final int RECENT_TOP_TRACK = 100;
    private static final int FEATURED_TOP_TRACK = 10;
    private static final int TOP_FIVE_SIZE = 5;
    private static final int FALLBACK_TIER_SIZE = 20;
    private static final long RECENT_TRACK_TTL_MS = 3600000; // 1 hour TTL for recent tracking
    private final Map<String, FeedSnapshot> feedSnapshots = new ConcurrentHashMap<>();

    // Track recent top-N for each user to enable session diversity
    // Key: ownerKey, Value: {recentIds: List, timestamp: Instant}
    private final Map<String, RecentTopTracker> recentTops = new ConcurrentHashMap<>();

    // Recent top tracker record
    private record RecentTopTracker(List<Integer> recentIds, Instant lastUpdated, long generation) {
        boolean isExpired() { return Instant.now().isAfter(lastUpdated.plusMillis(RECENT_TRACK_TTL_MS)); }
    }

    private final ContentRepository contentRepository;
    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final VoteRepository voteRepository;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    @Value("${ai-service.base-url:http://localhost:8000}")
    private String aiServiceBaseUrl;

    @Transactional(readOnly = true)
    public PersonalizedFeedResponse getPersonalizedFeed(String username, Integer limit, String cursor) {
        int effectiveLimit = Math.min(Math.max(limit != null ? limit : 20, 1), 50);
        log.info("TRACE getPersonalizedFeed: username={}, limit={}, effectiveLimit={}, cursor={}",
                username, limit, effectiveLimit, cursor != null ? "present" : "null");
        User user = username == null ? null : userRepository.findByUsername(username).orElse(null);
        String ownerKey = user == null ? "guest" : "user:" + user.getUserId();
        SnapshotCursor snapshotCursor = decodeCursor(cursor);
        log.info("TRACE: snapshotCursor={}", snapshotCursor != null ? snapshotCursor.snapshotId().substring(0,8) + " offset=" + snapshotCursor.offset() : "null (creating new)");
        FeedSnapshot snapshot = snapshotCursor == null ? createSnapshot(user, ownerKey) : getSnapshot(snapshotCursor, ownerKey);
        log.info("TRACE: snapshot.id={} contentIds.size={}", snapshot.id(), snapshot.contentIds().size());
        int offset = snapshotCursor == null ? 0 : snapshotCursor.offset();
        PersonalizedFeedResponse response = buildPage(snapshot, offset, effectiveLimit);
        log.info("TRACE RESPONSE: items={}, total={}, hasNextCursor={}, nextCursor={}",
                response.getItems().size(), response.getTotal(),
                response.getNextCursor() != null, response.getNextCursor() != null ? "present" : "null");
        return response;
    }

    private FeedSnapshot createSnapshot(User user, String ownerKey) {
        log.info("TRACE createSnapshot START: ownerKey={}, user={}", ownerKey, user != null ? user.getUserId() : "null");
        pruneExpiredSnapshots();
        List<Content> catalog = fetchPublicCatalog();

        // CRITICAL: Log catalog size and composition for debugging 63->25 issue
        log.info("TRACE CATALOG: size={}, MAX_CATALOG_SIZE={}, is_limited={}",
                catalog.size(), MAX_CATALOG_SIZE, catalog.size() >= MAX_CATALOG_SIZE);

        // DETAILED: Log catalog items in batches to avoid log overflow
        if (catalog.size() <= 20) {
            for (Content c : catalog) {
                log.info("  CATALOG_ITEM: id={}, title={}, type={}",
                        c.getContentId(), c.getTitle(), c.getContentType());
            }
        } else {
            log.info("  CATALOG first 10: {}", catalog.stream().limit(10).map(c -> c.getContentId()).toList());
            log.info("  CATALOG last 10: {}", catalog.stream().skip(Math.max(0, catalog.size() - 10)).map(c -> c.getContentId()).toList());
        }

        // NOTE: Health Profile (vegetarianType, dietary preferences, allergies) only affects
        // relevance SCORING for personalization, NOT hard filtering content from the feed.
        // Home Feed is a SOCIAL DISCOVERY feed - all eligible content must be visible to all users.
        // Dietary incompatibility → lower relevance score (soft deprioritization).
        // Hard blocking is ONLY for Meal Planner's safety constraints, not Home Feed.
        //
        // REMOVED: isHardBlocked() hard filter that was incorrectly excluding content.
        // REMOVED: fetchVegetarianType() that was used for blocking.
        // All catalog content now flows to AI for personalized ranking.

        // STEP 1: Eligible catalog = ALL public content (no dietary filtering)
        List<Content> eligibleCatalog = catalog.stream()
                .sorted(latestFirst())
                .toList();

        log.info("TRACE eligibleCatalog: size={}, ids={}", eligibleCatalog.size(), contentIds(eligibleCatalog));

        // STEP 2: Fetch user's Health Profile for soft personalization
        // vegetarianType is used ONLY for soft ranking (dietary penalty), NOT for hard filtering.
        // If user has no profile or no vegetarianType, null is sent to AI (no dietary penalty).
        String vegetarianType = fetchVegetarianType(user);
        log.info("TRACE vegetarianType={} (for soft ranking, NOT filtering)", vegetarianType);

        if (user == null) {
            List<Content> diversifiedCatalog = applySessionDiversity(
                    new LinkedHashSet<>(contentIds(eligibleCatalog)),
                    eligibleCatalog.stream().collect(Collectors.toMap(Content::getContentId, content -> content)),
                    fallbackRanking(eligibleCatalog), ownerKey, true);
            FeedSnapshot snap = saveSnapshot(ownerKey, diversifiedCatalog, Map.of(), true);
            log.info("TRACE createSnapshot GUEST: saved {} IDs", snap.contentIds().size());
            return snap;
        }

        List<RecommendationRequestDto.InteractionDto> interactions = fetchInteractions(user.getUserId());
        log.info("TRACE interactions: count={}", interactions.size());

        // STEP 3: Send to AI for personalized ranking
        // AI applies soft dietary penalty (deprioritization) but does NOT hard filter.
        // All eligible content flows to AI for ranking.
        // vegetarianType is sent for dietary-aware soft scoring; null means no dietary penalty.
        RecommendationRequestDto request = buildRecommendationRequest(
                eligibleCatalog, interactions, vegetarianType, AI_RANKING_LIMIT);
        log.info("TRACE AI request: catalogSize={}, limit={}, vegetarianType={} (for soft dietary scoring)",
                request.getContents().size(), request.getLimit(), vegetarianType);

        RecommendationResponseDto aiResponse;
        boolean isFallback = false;

        try {
            aiResponse = callAiService(request);
            log.info("TRACE AI response: items={}", aiResponse != null && aiResponse.getItems() != null ? aiResponse.getItems().size() : "null");
        } catch (Exception e) {
            log.warn("TRACE AI FAILED: {}, falling back", e.getMessage());
            aiResponse = null;
            isFallback = true;
        }

        List<RecommendationResponseDto.RecommendationItemDto> rankedItems = aiResponse == null || aiResponse.getItems() == null
                ? Collections.emptyList()
                : aiResponse.getItems();
        Map<Integer, Content> eligibleById = eligibleCatalog.stream()
                .collect(Collectors.toMap(Content::getContentId, content -> content));
        Map<Integer, String> reasons = new HashMap<>();
        LinkedHashSet<Integer> orderedIds = new LinkedHashSet<>();

        // STEP 4: Add AI-ranked items first
        for (RecommendationResponseDto.RecommendationItemDto item : rankedItems) {
            if (item != null && item.getContentId() != null && eligibleById.containsKey(item.getContentId())) {
                orderedIds.add(item.getContentId());
                reasons.putIfAbsent(item.getContentId(), item.getReason());
            }
        }
        log.info("TRACE AI ranked: count={}, ids={}", orderedIds.size(), orderedIds);

        // STEP 5: AI might return fewer than eligible catalog - check if this is the issue
        // CRITICAL: Log AI response content for debugging
        if (aiResponse != null && aiResponse.getItems() != null) {
            List<Integer> aiReturnedIds = aiResponse.getItems().stream()
                    .map(RecommendationResponseDto.RecommendationItemDto::getContentId)
                    .filter(Objects::nonNull)
                    .toList();
            Set<Integer> eligibleIds = eligibleCatalog.stream()
                    .map(Content::getContentId)
                    .collect(Collectors.toSet());
            List<Integer> eligibleNotInAI = eligibleIds.stream()
                    .filter(id -> !aiReturnedIds.contains(id))
                    .toList();
            log.info("TRACE AI COVERAGE: eligible_catalog_size={}, ai_returned_count={}, eligible_not_in_ai={}, will_fill_from_catalog={}",
                    eligibleCatalog.size(), aiReturnedIds.size(), eligibleNotInAI.size(), !eligibleNotInAI.isEmpty());
            log.info("TRACE AI_RETURNED_IDS: {}", aiReturnedIds);
            log.info("TRACE ELIGIBLE_NOT_IN_AI: ids={}", eligibleNotInAI);
        } else if (aiResponse == null) {
            log.info("TRACE AI COVERAGE: aiResponse is NULL (AI failed or unavailable)");
        } else {
            log.info("TRACE AI COVERAGE: aiResponse.getItems() is NULL");
        }

        if (orderedIds.isEmpty()) {
            isFallback = true;
            log.info("TRACE: AI returned empty, using fallback with {} eligible", eligibleCatalog.size());
        }

        // STEP 6: Append remaining eligible items (sorted by recency for deterministic fallback)
        eligibleCatalog.forEach(content -> orderedIds.add(content.getContentId()));

        // STEP 7: Session diversity - ensures new sessions see different top content
        // - Tracks recently shown top-N per user
        // - Prefers NEW content over recently shown (with similar scores)
        // - Uses a deterministic generation bucket for every new snapshot.
        //   This keeps a cursor stable while ensuring an exhausted RECENT set
        //   cannot restore the original fixed order.
        List<RecommendationResponseDto.RecommendationItemDto> diversityRanking = rankedItems.isEmpty()
                ? fallbackRanking(eligibleCatalog)
                : rankedItems;
        List<Content> orderedContents = applySessionDiversity(
                orderedIds, eligibleById, diversityRanking, ownerKey, isFallback);
        log.info("TRACE: Applied session diversity, recentTop updated");

        // CRITICAL SUMMARY: Show exactly what will be in the feed
        log.info("TRACE SUMMARY: owner={}, eligibleCatalog={}, orderedIds_after_ai={}, orderedIds_after_merge={}, orderedContents={}",
                ownerKey, eligibleCatalog.size(), orderedIds.size(), orderedIds.size(), orderedContents.size());

        // DETAILED: List all items that will be in the final feed
        log.info("TRACE FINAL_FEED_IDS: {}", contentIds(orderedContents));
        return saveSnapshot(ownerKey, orderedContents, reasons, isFallback);
    }

    private List<Content> fetchPublicCatalog() {
        return contentRepository.findPublicCatalogForRecommendation(PUBLISHED_STATUS, PageRequest.of(0, MAX_CATALOG_SIZE));
    }

    /**
     * Fetch user's vegetarian type from Health Profile for SOFT RANKING purposes.
     * This value is used ONLY for dietary-aware score adjustment, NOT for hard filtering.
     *
     * @param user the authenticated user (can be null for guest)
     * @return vegetarianType if user has one set, null otherwise
     */
    private String fetchVegetarianType(User user) {
        if (user == null) return null;
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
                // The AI contract requires arrays, not null. The current
                // content schema has no tag/ingredient relations, so an
                // empty array truthfully represents unavailable metadata.
                .tags(List.of())
                .ingredients(List.of())
                .dietaryTags(List.of())
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

    private FeedSnapshot saveSnapshot(String ownerKey, List<Content> contents, Map<Integer, String> reasons, boolean fallback) {
        String id = UUID.randomUUID().toString();
        FeedSnapshot snapshot = new FeedSnapshot(id, ownerKey, contentIds(contents), Map.copyOf(reasons), fallback, Instant.now());
        feedSnapshots.put(id, snapshot);
        log.info("Created feed snapshot={} owner={} candidates={} fallback={}", id, ownerKey, snapshot.contentIds().size(), fallback);
        return snapshot;
    }

    private FeedSnapshot getSnapshot(SnapshotCursor cursor, String ownerKey) {
        pruneExpiredSnapshots();
        FeedSnapshot snapshot = feedSnapshots.get(cursor.snapshotId());
        if (snapshot == null || !snapshot.ownerKey().equals(ownerKey)) {
            throw new BadRequestException("Feed cursor is expired or invalid; refresh the feed");
        }
        return snapshot;
    }

    private PersonalizedFeedResponse buildPage(FeedSnapshot snapshot, int offset, int limit) {
        log.info("TRACE buildPage: snapshotId={}, snapshot.contentIds.size={}, offset={}, limit={}",
                snapshot.id().substring(0,8), snapshot.contentIds().size(), offset, limit);
        int safeOffset = Math.min(Math.max(offset, 0), snapshot.contentIds().size());
        int end = Math.min(safeOffset + limit, snapshot.contentIds().size());
        log.info("TRACE buildPage: safeOffset={}, end={}, hasMore={}", safeOffset, end, end < snapshot.contentIds().size());
        List<Integer> pageIds = snapshot.contentIds().subList(safeOffset, end);
        log.info("TRACE buildPage: pageIds={}", pageIds);
        Map<Integer, Content> visibleContents = contentRepository.findPublicByIds(pageIds, PUBLISHED_STATUS).stream()
                .collect(Collectors.toMap(Content::getContentId, content -> content));
        List<PersonalizedFeedResponse.FeedItemResponse> items = pageIds.stream()
                .map(visibleContents::get)
                .filter(Objects::nonNull)
                .map(content -> toFeedItem(content, snapshot.reasons().getOrDefault(content.getContentId(), "cold_start")))
                .toList();
        log.info("TRACE buildPage: items.size={}, visibleContents.size={}, filteredNulls.size={}",
                items.size(), visibleContents.size(), pageIds.size() - visibleContents.size());
        String nextCursorVal = end < snapshot.contentIds().size() ? encodeCursor(snapshot.id(), end) : null;
        log.info("TRACE buildPage: nextCursor={}, total={}", nextCursorVal != null ? "present" : "null", snapshot.contentIds().size());
        return PersonalizedFeedResponse.builder()
                .items(items)
                .nextCursor(nextCursorVal)
                .total(snapshot.contentIds().size())
                .fallback(snapshot.fallback())
                .build();
    }

    private Comparator<Content> latestFirst() {
        return Comparator.comparing(Content::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(Content::getContentId, Comparator.nullsLast(Comparator.reverseOrder()));
    }

    private PersonalizedFeedResponse.FeedItemResponse toFeedItem(Content content, String reason) {
        String avatar = content.getUser() != null ? content.getUser().getAvatarUrl() : null;
        Long voteCount = contentRepository.countVoteByContentId(content.getContentId());

        return PersonalizedFeedResponse.FeedItemResponse.builder()
                .contentId(content.getContentId())
                .contentType(content.getContentType())
                .title(content.getTitle())
                .caption(extractFeedCaption(content.getBody()))
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

    private String extractFeedCaption(String body) {
        if (body == null || body.isBlank()) return null;
        String trimmed = body.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
                JsonNode root = objectMapper.readTree(trimmed);
                if (root != null) {
                    if (root.hasNonNull("story")) {
                        String story = root.get("story").asText("").trim();
                        if (!story.isBlank()) {
                            return story;
                        }
                    }
                    if (root.hasNonNull("description")) {
                        String desc = root.get("description").asText("").trim();
                        if (!desc.isBlank()) {
                            return desc;
                        }
                    }
                }
            } catch (Exception e) {
                log.debug("Failed to parse body as JSON in extractFeedCaption: {}", e.getMessage());
            }
        }
        Matcher boundary = RECIPE_SECTION_BOUNDARY.matcher(body);
        String caption = (boundary.find() ? body.substring(0, boundary.start()) : body).trim();
        return caption.isBlank() ? null : caption;
    }

    private SnapshotCursor decodeCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) return null;
        try {
            String decoded = new String(Base64.getDecoder().decode(cursor), StandardCharsets.UTF_8);
            String[] parts = decoded.split("\\" + CURSOR_SEPARATOR, 2);
            if (parts.length != 2 || parts[0].isBlank()) throw new IllegalArgumentException("Invalid cursor");
            return new SnapshotCursor(parts[0], Math.max(0, Integer.parseInt(parts[1])));
        } catch (Exception e) {
            throw new BadRequestException("Feed cursor is invalid; refresh the feed");
        }
    }

    private String encodeCursor(String snapshotId, int offset) {
        return Base64.getEncoder().encodeToString((snapshotId + CURSOR_SEPARATOR + offset).getBytes(StandardCharsets.UTF_8));
    }

    private void pruneExpiredSnapshots() {
        Instant expiresBefore = Instant.now().minusSeconds(SNAPSHOT_TTL_SECONDS);
        feedSnapshots.entrySet().removeIf(entry -> entry.getValue().createdAt().isBefore(expiresBefore));

        // Also prune expired recent-top trackers
        recentTops.entrySet().removeIf(entry -> entry.getValue().isExpired());
    }

    private List<Integer> contentIds(List<Content> contents) {
        return contents.stream().map(Content::getContentId).filter(Objects::nonNull).toList();
    }

    /**
     * When AI is unavailable (or the visitor is a guest), recency is the only
     * available relevance signal. Items in the same 20-item recency band are
     * therefore safe to rotate without promoting stale content above newer content.
     */
    private List<RecommendationResponseDto.RecommendationItemDto> fallbackRanking(List<Content> eligibleCatalog) {
        List<RecommendationResponseDto.RecommendationItemDto> result = new ArrayList<>();
        for (int index = 0; index < eligibleCatalog.size(); index++) {
            Content content = eligibleCatalog.get(index);
            int tier = index / FALLBACK_TIER_SIZE;
            result.add(RecommendationResponseDto.RecommendationItemDto.builder()
                    .contentId(content.getContentId())
                    .contentType(content.getContentType())
                    .score(Math.max(0.0, 1.0 - tier * 0.1))
                    .reason("cold_start")
                    .build());
        }
        return result;
    }

    /**
     * Builds a new ranked generation for a refresh while keeping the snapshot immutable
     * for cursor pagination. The old implementation rotated only tiny equal-score windows;
     * real AI score distributions frequently made those windows one item wide, so top five
     * never changed. Here, the candidate pool includes every AI-ranked result followed by
     * the recency-ranked catalog. Any content featured in this session's history is placed
     * after unseen candidates, so an item cannot keep occupying the same leading positions.
     */
    private List<Content> applySessionDiversity(
            LinkedHashSet<Integer> orderedIds,
            Map<Integer, Content> contentMap,
            List<RecommendationResponseDto.RecommendationItemDto> rankedItems,
            String ownerKey,
            boolean fallback) {

        if (rankedItems == null || rankedItems.isEmpty()) {
            return orderedIds.stream().map(contentMap::get).filter(Objects::nonNull).toList();
        }

        synchronized (recentTops) {
            RecentTopTracker tracker = recentTops.get(ownerKey);
            if (tracker == null || tracker.isExpired()) {
                tracker = new RecentTopTracker(List.of(), Instant.now(), 0);
            }
            long generation = tracker.generation();
            Set<Integer> sessionFeaturedIds = new HashSet<>(tracker.recentIds());
            List<Integer> rankedIds = new ArrayList<>();
            Set<Integer> seenRankedIds = new HashSet<>();

            for (RecommendationResponseDto.RecommendationItemDto item : rankedItems) {
                if (item == null || item.getContentId() == null || !contentMap.containsKey(item.getContentId())
                        || !seenRankedIds.add(item.getContentId())) {
                    continue;
                }
                rankedIds.add(item.getContentId());
            }
            List<Integer> resultIds = new ArrayList<>();
            List<Integer> qualityPool = new ArrayList<>(rankedIds);
            orderedIds.stream().filter(id -> !seenRankedIds.contains(id)).forEach(qualityPool::add);

            if (sessionFeaturedIds.isEmpty()) {
                resultIds.addAll(qualityPool);
            } else {
                // A hard session exposure penalty for the featured region. AI-ranked items
                // still come first; once AI has returned fewer than 50, recency is the
                // relevance baseline for the remaining catalog candidates.
                qualityPool.stream().filter(id -> !sessionFeaturedIds.contains(id)).forEach(resultIds::add);
                qualityPool.stream().filter(sessionFeaturedIds::contains).forEach(resultIds::add);

                long novelTopFive = resultIds.stream().limit(TOP_FIVE_SIZE)
                        .filter(id -> !sessionFeaturedIds.contains(id)).count();
                if (novelTopFive < TOP_FIVE_SIZE) {
                    log.info("Feed diversity target unavailable: owner={}, generation={}, novelTop5={}/{}, qualityPool={}, featuredHistory={}",
                            ownerKey, generation, novelTopFive, TOP_FIVE_SIZE,
                            qualityPool.size(), tracker.recentIds());
                }
            }

            for (Integer id : orderedIds) {
                if (!resultIds.contains(id)) resultIds.add(id);
            }

            List<Integer> topTen = resultIds.stream().limit(FEATURED_TOP_TRACK).toList();
            List<Integer> mergedHistory = new ArrayList<>(topTen);
            tracker.recentIds().stream().filter(id -> !mergedHistory.contains(id)).forEach(mergedHistory::add);
            List<Integer> featuredHistory = mergedHistory.stream().limit(RECENT_TOP_TRACK).toList();
            recentTops.put(ownerKey, new RecentTopTracker(featuredHistory, Instant.now(), generation + 1));
            int novelInTopFive = (int) resultIds.stream().limit(TOP_FIVE_SIZE)
                    .filter(id -> !sessionFeaturedIds.contains(id)).count();
            log.info("Feed diversity generation: owner={}, generation={}, qualityPool={}, featuredHistory={}, " +
                            "novelInTop5={}, targetNovelInTop5={}, finalTop10={}",
                    ownerKey, generation, qualityPool.size(), tracker.recentIds(), novelInTopFive, TOP_FIVE_SIZE,
                    resultIds.stream().limit(10).toList());
            return resultIds.stream().map(contentMap::get).filter(Objects::nonNull).toList();
        }
    }

    private record SnapshotCursor(String snapshotId, int offset) { }
    private record FeedSnapshot(String id, String ownerKey, List<Integer> contentIds,
                                Map<Integer, String> reasons, boolean fallback, Instant createdAt) { }
}
