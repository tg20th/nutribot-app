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

@Slf4j
@Service
@RequiredArgsConstructor
public class PersonalizedFeedService {

    private static final String PUBLISHED_STATUS = "published";
    private static final int MAX_CATALOG_SIZE = 5000;
    private static final int MAX_INTERACTIONS = 1000;
    private static final int AI_RANKING_LIMIT = 50;
    private static final String CURSOR_SEPARATOR = ".";
    private static final long SNAPSHOT_TTL_SECONDS = 600;
    // Session diversity: track recent top-N to avoid exact repetition
    private static final int RECENT_TOP_TRACK = 20;  // Track last 20 to avoid repeating top 10
    private static final int FALLBACK_TIER_SIZE = 20;
    private static final int MAX_RELEVANCE_WINDOW_SIZE = 8;
    private static final double SCORE_GAP_PERCENTILE = 0.75;
    private static final long RECENT_TRACK_TTL_MS = 3600000; // 1 hour TTL for recent tracking
    private static final Set<String> ANIMAL_INGREDIENTS = Set.of("meat", "beef", "pork", "chicken", "poultry", "fish", "seafood", "shrimp", "gelatin", "thịt", "bò", "heo", "gà", "cá", "tôm");
    private static final Set<String> EGG_INGREDIENTS = Set.of("egg", "trứng");
    private static final Set<String> DAIRY_INGREDIENTS = Set.of("milk", "dairy", "cheese", "butter", "yogurt", "whey", "casein", "sữa", "phô mai", "bơ");
    private static final Map<String, FeedSnapshot> FEED_SNAPSHOTS = new ConcurrentHashMap<>();

    // Track recent top-N for each user to enable session diversity
    // Key: ownerKey, Value: {recentIds: List, timestamp: Instant}
    private static final Map<String, RecentTopTracker> RECENT_TOPS = new ConcurrentHashMap<>();

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

        String vegetarianType = user == null ? null : fetchVegetarianType(user);
        log.info("TRACE vegetarianType={}, isLoggedIn={}", vegetarianType, user != null);

        // STEP 1: Identify HARDBLOCK items
        final Set<Integer> hardBlockedIds;
        if (vegetarianType != null && !vegetarianType.isBlank()) {
            List<Content> hardBlocked = catalog.stream()
                    .filter(content -> isHardBlocked(content, vegetarianType))
                    .toList();
            hardBlockedIds = hardBlocked.stream().map(Content::getContentId).collect(Collectors.toSet());

            // DETAILED: Log why each item is blocked
            log.info("TRACE HARDBLOCK: count={}", hardBlockedIds.size());
            for (Content c : hardBlocked) {
                String reason = getHardBlockReason(c, vegetarianType);
                log.info("  HARDBLOCK_ITEM: id={}, title={}, reason={}",
                        c.getContentId(), c.getTitle(), reason);
            }
        } else {
            hardBlockedIds = Set.of();
            log.info("TRACE HARDBLOCK: count=0 (no vegetarian type)");
        }

        // STEP 2: Eligible catalog = all - hardblocked
        List<Content> eligibleCatalog = catalog.stream()
                .filter(content -> !hardBlockedIds.contains(content.getContentId()))
                .sorted(latestFirst())
                .toList();

        // DETAILED: List all excluded items with reasons
        List<Integer> excludedByHardblock = catalog.stream()
                .map(Content::getContentId)
                .filter(id -> !eligibleCatalog.stream().anyMatch(c -> c.getContentId().equals(id)))
                .toList();
        log.info("TRACE FILTER_REASON: total={}, hardblock_excluded={}, eligible={}",
                catalog.size(), excludedByHardblock.size(), eligibleCatalog.size());
        if (!excludedByHardblock.isEmpty()) {
            log.info("TRACE EXCLUDED_IDS: {}", excludedByHardblock);
        }

        log.info("TRACE eligibleCatalog: size={}, ids={}", eligibleCatalog.size(), contentIds(eligibleCatalog));

        if (user == null) {
            List<Content> diversifiedCatalog = applySessionDiversity(
                    new LinkedHashSet<>(contentIds(eligibleCatalog)),
                    eligibleCatalog.stream().collect(Collectors.toMap(Content::getContentId, content -> content)),
                    fallbackRanking(eligibleCatalog), ownerKey);
            FeedSnapshot snap = saveSnapshot(ownerKey, diversifiedCatalog, Map.of(), true);
            log.info("TRACE createSnapshot GUEST: saved {} IDs", snap.contentIds().size());
            return snap;
        }

        List<RecommendationRequestDto.InteractionDto> interactions = fetchInteractions(user.getUserId());
        log.info("TRACE interactions: count={}", interactions.size());

        // STEP 3: Send to AI for ranking only
        // IMPORTANT: Do NOT send vegetarianType to AI. Backend already filtered dietary.
        // If vegetarianType is sent, AI will ALSO filter dietary internally and return only
        // compatible items. This causes AI to return a SUBSET instead of ranking ALL eligible items.
        // AI's role is to RANK, not to FILTER. Filtering is already done by Backend.
        RecommendationRequestDto request = buildRecommendationRequest(
                eligibleCatalog, interactions, null, AI_RANKING_LIMIT);  // vegetarianType = null for AI
        log.info("TRACE AI request: catalogSize={}, limit={}, vegetarianType_sent_to_ai=null (backend already filtered)",
                request.getContents().size(), request.getLimit());

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
                orderedIds, eligibleById, diversityRanking, ownerKey);
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
        FEED_SNAPSHOTS.put(id, snapshot);
        log.info("Created feed snapshot={} owner={} candidates={} fallback={}", id, ownerKey, snapshot.contentIds().size(), fallback);
        return snapshot;
    }

    private FeedSnapshot getSnapshot(SnapshotCursor cursor, String ownerKey) {
        pruneExpiredSnapshots();
        FeedSnapshot snapshot = FEED_SNAPSHOTS.get(cursor.snapshotId());
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

    /**
     * HARD BLOCK: Safety-critical filtering for dietary restrictions.
     * Only blocks items with ANIMAL-BASED ingredients that would harm users with strict restrictions.
     * Soft preference mismatches (e.g., vegan sees dairy-only recipe) are NOT blocked here -
     * they are sent to AI for soft deprioritization, not hard elimination.
     */
    private boolean isHardBlocked(Content content, String vegetarianType) {
        if (vegetarianType == null || vegetarianType.isBlank()) return false;
        String text = String.join(" ", Objects.toString(content.getTitle(), ""), Objects.toString(content.getBody(), "")).toLowerCase(Locale.ROOT);

        // ALWAYS block meat/animal products for any vegetarian type (safety-critical)
        if (containsAny(text, ANIMAL_INGREDIENTS)) return true;

        // Block eggs for LACTO (lacto-vegetarians don't eat eggs)
        if (vegetarianType.equalsIgnoreCase("LACTO") && containsAny(text, EGG_INGREDIENTS)) return true;

        // Block dairy for OVO (ovo-vegetarians don't eat dairy)
        if (vegetarianType.equalsIgnoreCase("OVO") && containsAny(text, DAIRY_INGREDIENTS)) return true;

        // VEGAN and LACTO_OVO: No additional restrictions beyond animal products above
        return false;
    }

    private String getHardBlockReason(Content content, String vegetarianType) {
        if (vegetarianType == null || vegetarianType.isBlank()) return "no_restriction";
        String text = String.join(" ", Objects.toString(content.getTitle(), ""), Objects.toString(content.getBody(), "")).toLowerCase(Locale.ROOT);

        if (containsAny(text, ANIMAL_INGREDIENTS)) return "contains_animal_products";
        if (vegetarianType.equalsIgnoreCase("LACTO") && containsAny(text, EGG_INGREDIENTS)) return "lacto_blocks_egg";
        if (vegetarianType.equalsIgnoreCase("OVO") && containsAny(text, DAIRY_INGREDIENTS)) return "ovo_blocks_dairy";
        return "unknown";
    }

    /**
     * @deprecated Only used for logging. Hardblock is now in isHardBlocked().
     */
    @Deprecated
    private boolean isDietaryCompatible(Content content, String vegetarianType) {
        if (vegetarianType == null || vegetarianType.isBlank()) return true;
        String text = String.join(" ", Objects.toString(content.getTitle(), ""), Objects.toString(content.getBody(), "")).toLowerCase(Locale.ROOT);
        if (containsAny(text, ANIMAL_INGREDIENTS)) return false;
        return switch (vegetarianType.toUpperCase(Locale.ROOT)) {
            case "VEGAN" -> !containsAny(text, EGG_INGREDIENTS) && !containsAny(text, DAIRY_INGREDIENTS);
            case "LACTO" -> !containsAny(text, EGG_INGREDIENTS);
            case "OVO" -> !containsAny(text, DAIRY_INGREDIENTS);
            case "LACTO_OVO" -> true;
            default -> false;
        };
    }

    private boolean containsAny(String text, Set<String> terms) {
        return terms.stream().anyMatch(text::contains);
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
        FEED_SNAPSHOTS.entrySet().removeIf(entry -> entry.getValue().createdAt().isBefore(expiresBefore));

        // Also prune expired recent-top trackers
        RECENT_TOPS.entrySet().removeIf(entry -> entry.getValue().isExpired());
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
     * Apply SESSION DIVERSITY - ensures new sessions see different top content.
     *
     * It rotates only within a score tier. A deterministic generation offset
     * guarantees a new snapshot changes eligible top content instead of relying
     * on chance, while a cursor continues to read its saved snapshot unchanged.
     */
    private List<Content> applySessionDiversity(
            LinkedHashSet<Integer> orderedIds,
            Map<Integer, Content> contentMap,
            List<RecommendationResponseDto.RecommendationItemDto> rankedItems,
            String ownerKey) {

        if (rankedItems == null || rankedItems.isEmpty()) {
            return orderedIds.stream().map(contentMap::get).filter(Objects::nonNull).toList();
        }

        synchronized (RECENT_TOPS) {
            RecentTopTracker tracker = RECENT_TOPS.get(ownerKey);
            if (tracker == null || tracker.isExpired()) {
                tracker = new RecentTopTracker(List.of(), Instant.now(), 0);
            }
            long generation = tracker.generation();
            Set<Integer> recentTopIds = new HashSet<>(tracker.recentIds());
            List<DiversityItem> rankedItemsForDiversity = new ArrayList<>();
            Set<Integer> rankedIds = new HashSet<>();
            int rankPosition = 0;

            for (RecommendationResponseDto.RecommendationItemDto item : rankedItems) {
                if (item == null || item.getContentId() == null || !contentMap.containsKey(item.getContentId())
                        || !rankedIds.add(item.getContentId())) {
                    continue;
                }
                double score = item.getScore() == null ? 0.0 : item.getScore();
                rankedItemsForDiversity.add(new DiversityItem(item.getContentId(), score,
                        !recentTopIds.contains(item.getContentId()), rankPosition++));
            }

            RelevanceWindows relevanceWindows = buildRelevanceWindows(rankedItemsForDiversity);
            List<Integer> resultIds = new ArrayList<>();
            for (int windowIndex = 0; windowIndex < relevanceWindows.windows().size(); windowIndex++) {
                List<DiversityItem> window = relevanceWindows.windows().get(windowIndex);
                List<DiversityItem> fresh = window.stream().filter(DiversityItem::isNew).toList();
                List<DiversityItem> recent = window.stream().filter(item -> !item.isNew()).toList();
                appendRotated(resultIds, fresh, generation + windowIndex);
                appendRotated(resultIds, recent, generation + windowIndex);
            }
            for (Integer id : orderedIds) {
                if (!rankedIds.contains(id)) resultIds.add(id);
            }

            List<Integer> topN = resultIds.stream().limit(RECENT_TOP_TRACK).toList();
            RECENT_TOPS.put(ownerKey, new RecentTopTracker(topN, Instant.now(), generation + 1));
            log.info("TRACE DIVERSITY: owner={}, generation={}, recentTopIdsBefore={}, recentTopIdsAfter={}, " +
                            "scoreGapThreshold={}, candidateWindows={}, rotationBuckets={}, rotatableCandidates={}, finalTop10={}",
                    ownerKey, generation, recentTopIds,
                    topN,
                    String.format(Locale.ROOT, "%.6f", relevanceWindows.gapThreshold()),
                    describeWindows(relevanceWindows.windows()),
                    rotationBuckets(relevanceWindows.windows(), generation),
                    rankedItemsForDiversity.size(),
                    resultIds.stream().limit(10).toList());
            return resultIds.stream().map(contentMap::get).filter(Objects::nonNull).toList();
        }
    }

    /**
     * Scores supplied by the recommender are adjusted ranking values, not probabilities.
     * Group adjacent rank positions by their observed score gaps rather than assuming a
     * [0,1] scale. Windows preserve the AI ranking between groups; only near-neighbours
     * within a bounded window can rotate.
     */
    private RelevanceWindows buildRelevanceWindows(List<DiversityItem> rankedItems) {
        if (rankedItems.isEmpty()) return new RelevanceWindows(List.of(), 0.0);

        List<Double> gaps = new ArrayList<>();
        for (int index = 1; index < rankedItems.size(); index++) {
            gaps.add(Math.abs(rankedItems.get(index - 1).score() - rankedItems.get(index).score()));
        }
        double gapThreshold = percentile(gaps, SCORE_GAP_PERCENTILE);
        List<List<DiversityItem>> windows = new ArrayList<>();
        List<DiversityItem> currentWindow = new ArrayList<>();
        for (DiversityItem item : rankedItems) {
            if (!currentWindow.isEmpty()) {
                double gap = Math.abs(currentWindow.getLast().score() - item.score());
                if (gap > gapThreshold || currentWindow.size() >= MAX_RELEVANCE_WINDOW_SIZE) {
                    windows.add(List.copyOf(currentWindow));
                    currentWindow.clear();
                }
            }
            currentWindow.add(item);
        }
        if (!currentWindow.isEmpty()) windows.add(List.copyOf(currentWindow));
        return new RelevanceWindows(List.copyOf(windows), gapThreshold);
    }

    private double percentile(List<Double> values, double percentile) {
        if (values.isEmpty()) return 0.0;
        List<Double> sorted = values.stream().sorted().toList();
        int index = Math.min(sorted.size() - 1, (int) Math.ceil(percentile * sorted.size()) - 1);
        return sorted.get(Math.max(0, index));
    }

    private List<String> describeWindows(List<List<DiversityItem>> windows) {
        List<String> description = new ArrayList<>();
        for (int index = 0; index < windows.size(); index++) {
            List<DiversityItem> window = windows.get(index);
            description.add("window" + index + ":size=" + window.size() + ",ids=" + window.stream()
                    .map(item -> item.contentId() + "=" + String.format(Locale.ROOT, "%.3f", item.score()))
                    .toList());
        }
        return description;
    }

    private Map<Integer, Integer> rotationBuckets(List<List<DiversityItem>> windows, long generation) {
        Map<Integer, Integer> buckets = new LinkedHashMap<>();
        for (int index = 0; index < windows.size(); index++) {
            buckets.put(index, Math.floorMod(generation + index, windows.get(index).size()));
        }
        return buckets;
    }

    private void appendRotated(List<Integer> target, List<DiversityItem> items, long offset) {
        if (items.isEmpty()) return;
        int start = (int) Math.floorMod(offset, items.size());
        for (int index = 0; index < items.size(); index++) {
            target.add(items.get((start + index) % items.size()).contentId());
        }
    }

    private record DiversityItem(int contentId, double score, boolean isNew, int rankPosition) {}
    private record RelevanceWindows(List<List<DiversityItem>> windows, double gapThreshold) {}

    private record SnapshotCursor(String snapshotId, int offset) { }
    private record FeedSnapshot(String id, String ownerKey, List<Integer> contentIds,
                                Map<Integer, String> reasons, boolean fallback, Instant createdAt) { }
}
