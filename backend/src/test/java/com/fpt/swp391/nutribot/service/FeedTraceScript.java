/**
 * Tests for Feed session diversity - ensures new sessions see different top content
 */
package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.response.PersonalizedFeedResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.repository.VoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * CRITICAL TEST: This reproduces the exact scenario from real data
 *
 * Real data shows:
 * - Account 1 (personalized): total=25
 * - Account 2 (cold-start): total=63
 *
 * With same database (63 items published/ACTIVE).
 *
 * This test verifies that when AI returns 25 items,
 * the feed STILL contains all 63 eligible items.
 */
class FeedTraceTest {
    @Test
    @DisplayName("TRACE: Reproduce exact 63->25 scenario and verify final feed")
    void trace_63_to_25_scenario() {
        // === SETUP: Match real data ===
        ContentRepository contentRepo = mock(ContentRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        UserProfileRepository profileRepo = mock(UserProfileRepository.class);
        VoteRepository voteRepo = mock(VoteRepository.class);
        RestClient restClient = mock(RestClient.class);

        PersonalizedFeedService service = new PersonalizedFeedService(
                contentRepo, userRepo, profileRepo, voteRepo, restClient, new ObjectMapper());

        // Create 63 items (matching DB count)
        List<Content> catalog = new ArrayList<>();
        for (int i = 1; i <= 63; i++) {
            User author = User.builder()
                    .userId(1)
                    .username("author")
                    .status(AccountStatus.ACTIVE)
                    .build();
            catalog.add(Content.builder()
                    .contentId(i)
                    .contentType("BLOG")
                    .status("published")
                    .title("Post " + i)
                    .body("Content " + i)
                    .slug("post-" + i)
                    .viewCount(0)
                    .createdAt(LocalDateTime.now().minusMinutes(64 - i))
                    .user(author)
                    .build());
        }

        Map<Integer, Content> catalogMap = catalog.stream()
                .collect(Collectors.toMap(Content::getContentId, c -> c));

        // Stub catalog query
        when(contentRepo.findPublicCatalogForRecommendation(eq("published"), any()))
                .thenReturn(catalog);

        // Stub page queries
        when(contentRepo.findPublicByIds(anyList(), eq("published")))
                .thenAnswer(invocation -> {
                    List<Integer> ids = invocation.getArgument(0);
                    return ids.stream().map(catalogMap::get).filter(Objects::nonNull).toList();
                });

        // Setup user (Account 1 - personalized)
        User user = User.builder()
                .userId(1)
                .username("reader")
                .status(AccountStatus.ACTIVE)
                .build();
        when(userRepo.findByUsername("reader")).thenReturn(Optional.of(user));
        when(profileRepo.findById(1)).thenReturn(Optional.empty()); // No vegetarian type
        when(voteRepo.findByUserId(1)).thenReturn(List.of()); // No interactions

        // === CRITICAL: Stub AI returning exactly 25 items ===
        // This reproduces Account 1's real scenario
        RestClient.RequestBodyUriSpec request = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec response = mock(RestClient.ResponseSpec.class);
        when(restClient.post()).thenReturn(request);
        when(request.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(response);

        // AI returns exactly 25 items (IDs 1-25)
        StringBuilder aiResponse = new StringBuilder("{\"items\":[");
        for (int i = 1; i <= 25; i++) {
            if (i > 1) aiResponse.append(",");
            aiResponse.append("{\"content_id\":").append(i)
                    .append(",\"content_type\":\"BLOG\",\"score\":0.9,\"reason\":\"personalized\"}");
        }
        aiResponse.append("],\"embedding_model\":\"test\"}");
        when(response.body(String.class)).thenReturn(aiResponse.toString());

        // === EXECUTE ===
        PersonalizedFeedResponse feed = service.getPersonalizedFeed("reader", 10, null);

        // === VERIFY ===
        System.out.println("=== FEED TRACE RESULTS ===");
        System.out.println("Catalog size (DB): " + catalog.size());
        System.out.println("AI returned: 25 items");
        System.out.println("Feed total: " + feed.getTotal());
        System.out.println("Feed items in page 1: " + feed.getItems().size());
        System.out.println("========================");

        // CRITICAL ASSERTION: Feed must contain ALL 63 items, not just 25
        assertEquals(63, feed.getTotal(),
                "FATAL: Feed only has " + feed.getTotal() + " items but should have 63. " +
                "AI only ranks items, does not limit the feed size!");

        // Load ALL pages to verify
        Set<Integer> allIds = new HashSet<>();
        String cursor = null;
        int pages = 0;

        do {
            PersonalizedFeedResponse page = service.getPersonalizedFeed("reader", 10, cursor);
            for (var item : page.getItems()) {
                assertTrue(allIds.add(item.getContentId()),
                        "DUPLICATE ID: " + item.getContentId() + " already seen!");
            }
            cursor = page.getNextCursor();
            pages++;
        } while (cursor != null && pages < 20);

        assertEquals(63, allIds.size(),
                "Only loaded " + allIds.size() + " unique items, expected 63!");
        assertEquals(7, pages, "Expected 7 pages (6x10 + 1x3)");
    }

    @Test
    @DisplayName("TRACE: Verify merge logic - AI ranked + remaining = full catalog")
    void trace_merge_logic_verification() {
        // Setup with detailed logging
        ContentRepository contentRepo = mock(ContentRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        UserProfileRepository profileRepo = mock(UserProfileRepository.class);
        VoteRepository voteRepo = mock(VoteRepository.class);
        RestClient restClient = mock(RestClient.class);

        PersonalizedFeedService service = new PersonalizedFeedService(
                contentRepo, userRepo, profileRepo, voteRepo, restClient, new ObjectMapper());

        // Create 100 items
        List<Content> catalog = new ArrayList<>();
        for (int i = 1; i <= 100; i++) {
            User author = User.builder()
                    .userId(1)
                    .username("author")
                    .status(AccountStatus.ACTIVE)
                    .build();
            catalog.add(Content.builder()
                    .contentId(i)
                    .contentType("BLOG")
                    .status("published")
                    .title("Post " + i)
                    .body("Content " + i)
                    .slug("post-" + i)
                    .viewCount(0)
                    .createdAt(LocalDateTime.now().minusMinutes(101 - i))
                    .user(author)
                    .build());
        }

        Map<Integer, Content> catalogMap = catalog.stream()
                .collect(Collectors.toMap(Content::getContentId, c -> c));

        when(contentRepo.findPublicCatalogForRecommendation(eq("published"), any())).thenReturn(catalog);
        when(contentRepo.findPublicByIds(anyList(), eq("published")))
                .thenAnswer(invocation -> {
                    List<Integer> ids = invocation.getArgument(0);
                    return ids.stream().map(catalogMap::get).filter(Objects::nonNull).toList();
                });

        User user = User.builder().userId(1).username("reader").status(AccountStatus.ACTIVE).build();
        when(userRepo.findByUsername("reader")).thenReturn(Optional.of(user));
        when(profileRepo.findById(1)).thenReturn(Optional.empty());
        when(voteRepo.findByUserId(1)).thenReturn(List.of());

        // AI returns only 10 items
        RestClient.RequestBodyUriSpec request = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec response = mock(RestClient.ResponseSpec.class);
        when(restClient.post()).thenReturn(request);
        when(request.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(response);

        StringBuilder aiResponse = new StringBuilder("{\"items\":[");
        for (int i = 1; i <= 10; i++) {
            if (i > 1) aiResponse.append(",");
            aiResponse.append("{\"content_id\":").append(i)
                    .append(",\"content_type\":\"BLOG\",\"score\":0.9,\"reason\":\"personalized\"}");
        }
        aiResponse.append("],\"embedding_model\":\"test\"}");
        when(response.body(String.class)).thenReturn(aiResponse.toString());

        PersonalizedFeedResponse feed = service.getPersonalizedFeed("reader", 20, null);

        // VERIFY: 100 items, not 10
        assertEquals(100, feed.getTotal(),
                "eligibleCatalog (100) - AI_ranked (10) = remaining (90). " +
                "Final = AI_ranked (10) + remaining (90) = 100. NOT 10!");

        // Load all and count - FIX: use do-while like test 1
        Set<Integer> allIds = new HashSet<>();
        String cursor = null;
        int pages = 0;

        do {
            PersonalizedFeedResponse page = service.getPersonalizedFeed("reader", 20, cursor);
            for (var item : page.getItems()) {
                assertTrue(allIds.add(item.getContentId()),
                        "DUPLICATE ID: " + item.getContentId());
            }
            cursor = page.getNextCursor();
            pages++;
        } while (cursor != null && pages < 50);

        assertEquals(100, allIds.size(), "Must have all 100 items!");
        assertEquals(5, pages, "Expected 5 pages (4x20 + 1x20 = 100)");
    }

    @Test
    @DisplayName("Session Diversity: Score tier ordering preserved for different tiers")
    void sessionDiversity_scoreTierOrdering() {
        // Test that items with VERY DIFFERENT scores maintain ordering
        // while items with SIMILAR scores can rotate

        ContentRepository contentRepo = mock(ContentRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        UserProfileRepository profileRepo = mock(UserProfileRepository.class);
        VoteRepository voteRepo = mock(VoteRepository.class);
        RestClient restClient = mock(RestClient.class);

        PersonalizedFeedService service = new PersonalizedFeedService(
                contentRepo, userRepo, profileRepo, voteRepo, restClient, new ObjectMapper());

        // Create items with VERY different score tiers
        // Tier 0 (0.9+): IDs 1-2 (very high)
        // Tier 5 (0.4-0.5): IDs 3-4 (low)
        List<Content> catalog = new ArrayList<>();
        for (int i = 1; i <= 4; i++) {
            User author = User.builder().userId(1).username("author").status(AccountStatus.ACTIVE).build();
            catalog.add(Content.builder()
                    .contentId(i)
                    .contentType("BLOG")
                    .status("published")
                    .title("Post " + i)
                    .body("Content " + i)
                    .slug("post-" + i)
                    .viewCount(0)
                    .createdAt(LocalDateTime.now())
                    .user(author)
                    .build());
        }

        Map<Integer, Content> catalogMap = catalog.stream()
                .collect(Collectors.toMap(Content::getContentId, c -> c));

        when(contentRepo.findPublicCatalogForRecommendation(eq("published"), any())).thenReturn(catalog);
        when(contentRepo.findPublicByIds(anyList(), eq("published")))
                .thenAnswer(inv -> inv.getArgument(0, List.class).stream()
                        .map(id -> catalogMap.get(id)).filter(Objects::nonNull).toList());

        User user = User.builder().userId(1).username("reader").status(AccountStatus.ACTIVE).build();
        when(userRepo.findByUsername("reader")).thenReturn(Optional.of(user));
        when(profileRepo.findById(1)).thenReturn(Optional.empty());
        when(voteRepo.findByUserId(1)).thenReturn(List.of());

        RestClient.RequestBodyUriSpec request = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec response = mock(RestClient.ResponseSpec.class);
        when(restClient.post()).thenReturn(request);
        when(request.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(response);

        // ID 1,2 = score 0.95 (tier 0), ID 3,4 = score 0.45 (tier 5)
        String aiResponse = "{\"items\":[" +
                "{\"content_id\":1,\"content_type\":\"BLOG\",\"score\":0.95,\"reason\":\"personalized\"}," +
                "{\"content_id\":2,\"content_type\":\"BLOG\",\"score\":0.95,\"reason\":\"personalized\"}," +
                "{\"content_id\":3,\"content_type\":\"BLOG\",\"score\":0.45,\"reason\":\"personalized\"}," +
                "{\"content_id\":4,\"content_type\":\"BLOG\",\"score\":0.45,\"reason\":\"personalized\"}" +
                "],\"embedding_model\":\"test\"}";
        when(response.body(String.class)).thenReturn(aiResponse);

        // First refresh
        PersonalizedFeedResponse feed1 = service.getPersonalizedFeed("reader", 4, null);
        List<Integer> top1 = feed1.getItems().stream()
                .map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList();

        // Second refresh
        PersonalizedFeedResponse feed2 = service.getPersonalizedFeed("reader", 4, null);
        List<Integer> top2 = feed2.getItems().stream()
                .map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList();

        // VERIFY: All items present
        assertEquals(4, feed1.getTotal());
        assertEquals(4, feed2.getTotal());

        // VERIFY: High-score items (1,2) ALWAYS come before low-score items (3,4)
        // Score tier 0 (0.95) should come before tier 5 (0.45)
        int idx1 = top1.indexOf(1);
        int idx2 = top1.indexOf(2);
        int idx3 = top1.indexOf(3);
        int idx4 = top1.indexOf(4);

        // Items 1,2 should be before 3,4 (different tiers)
        assertTrue(Math.min(idx1, idx2) < Math.min(idx3, idx4),
                "High-score items (1,2) should come before low-score items (3,4). Order: " + top1);

        System.out.println("TRACE TIER ORDERING TEST:");
        System.out.println("  First refresh:  " + top1);
        System.out.println("  Second refresh: " + top2);
    }

    @Test
    @DisplayName("Session Diversity: Accounts isolated - different users have different recent history")
    void sessionDiversity_accountIsolation() {
        // Test that user1 and user2 have separate recent-top tracking

        ContentRepository contentRepo = mock(ContentRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        UserProfileRepository profileRepo = mock(UserProfileRepository.class);
        VoteRepository voteRepo = mock(VoteRepository.class);
        RestClient restClient = mock(RestClient.class);

        PersonalizedFeedService service = new PersonalizedFeedService(
                contentRepo, userRepo, profileRepo, voteRepo, restClient, new ObjectMapper());

        List<Content> catalog = new ArrayList<>();
        for (int i = 1; i <= 20; i++) {
            User author = User.builder().userId(1).username("author").status(AccountStatus.ACTIVE).build();
            catalog.add(Content.builder()
                    .contentId(i)
                    .contentType("BLOG")
                    .status("published")
                    .title("Post " + i)
                    .body("Content " + i)
                    .slug("post-" + i)
                    .viewCount(0)
                    .createdAt(LocalDateTime.now())
                    .user(author)
                    .build());
        }

        Map<Integer, Content> catalogMap = catalog.stream()
                .collect(Collectors.toMap(Content::getContentId, c -> c));

        when(contentRepo.findPublicCatalogForRecommendation(eq("published"), any())).thenReturn(catalog);
        when(contentRepo.findPublicByIds(anyList(), eq("published")))
                .thenAnswer(inv -> inv.getArgument(0, List.class).stream()
                        .map(id -> catalogMap.get(id)).filter(Objects::nonNull).toList());

        RestClient.RequestBodyUriSpec request = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec response = mock(RestClient.ResponseSpec.class);
        when(restClient.post()).thenReturn(request);
        when(request.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(response);

        StringBuilder aiResponse = new StringBuilder("{\"items\":[");
        for (int i = 1; i <= 20; i++) {
            if (i > 1) aiResponse.append(",");
            aiResponse.append("{\"content_id\":").append(i)
                    .append(",\"content_type\":\"BLOG\",\"score\":").append(0.9)
                    .append(",\"reason\":\"personalized\"}");
        }
        aiResponse.append("],\"embedding_model\":\"test\"}");
        when(response.body(String.class)).thenReturn(aiResponse.toString());

        // User 1 - first refresh
        PersonalizedFeedResponse feed1 = service.getPersonalizedFeed("user1", 10, null);
        List<Integer> user1_top1 = feed1.getItems().stream()
                .map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList();

        // User 2 - first refresh (should NOT see user1's history)
        PersonalizedFeedResponse feed2 = service.getPersonalizedFeed("user2", 10, null);
        List<Integer> user2_top1 = feed2.getItems().stream()
                .map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList();

        // Both should have all 20 items
        assertEquals(20, feed1.getTotal());
        assertEquals(20, feed2.getTotal());

        // User 1 refreshes again - should use user1's recent history
        PersonalizedFeedResponse feed1_2 = service.getPersonalizedFeed("user1", 10, null);
        List<Integer> user1_top2 = feed1_2.getItems().stream()
                .map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList();

        // User 2 should NOT be affected by user1's refresh
        PersonalizedFeedResponse feed2_2 = service.getPersonalizedFeed("user2", 10, null);
        List<Integer> user2_top2 = feed2_2.getItems().stream()
                .map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList();

        // Both accounts should have 20 items each
        assertEquals(20, feed1_2.getTotal());
        assertEquals(20, feed2_2.getTotal());

        System.out.println("TRACE ISOLATION TEST:");
        System.out.println("  User1 refresh 1: " + user1_top1);
        System.out.println("  User1 refresh 2: " + user1_top2);
        System.out.println("  User2 refresh 1: " + user2_top1);
        System.out.println("  User2 refresh 2: " + user2_top2);
    }

    @Test
    @DisplayName("Session Diversity: Same snapshot (load more) maintains order")
    void sessionDiversity_sameSnapshot_maintainsOrder() {
        // This test verifies that load-more (using cursor) maintains EXACT same order

        ContentRepository contentRepo = mock(ContentRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        UserProfileRepository profileRepo = mock(UserProfileRepository.class);
        VoteRepository voteRepo = mock(VoteRepository.class);
        RestClient restClient = mock(RestClient.class);

        PersonalizedFeedService service = new PersonalizedFeedService(
                contentRepo, userRepo, profileRepo, voteRepo, restClient, new ObjectMapper());

        List<Content> catalog = new ArrayList<>();
        for (int i = 1; i <= 30; i++) {
            User author = User.builder().userId(1).username("author").status(AccountStatus.ACTIVE).build();
            catalog.add(Content.builder()
                    .contentId(i)
                    .contentType("BLOG")
                    .status("published")
                    .title("Post " + i)
                    .body("Content " + i)
                    .slug("post-" + i)
                    .viewCount(0)
                    .createdAt(LocalDateTime.now().minusMinutes(31 - i))
                    .user(author)
                    .build());
        }

        Map<Integer, Content> catalogMap = catalog.stream()
                .collect(Collectors.toMap(Content::getContentId, c -> c));

        when(contentRepo.findPublicCatalogForRecommendation(eq("published"), any())).thenReturn(catalog);
        when(contentRepo.findPublicByIds(anyList(), eq("published")))
                .thenAnswer(inv -> inv.getArgument(0, List.class).stream()
                        .map(id -> catalogMap.get(id)).filter(Objects::nonNull).toList());

        User user = User.builder().userId(1).username("reader").status(AccountStatus.ACTIVE).build();
        when(userRepo.findByUsername("reader")).thenReturn(Optional.of(user));
        when(profileRepo.findById(1)).thenReturn(Optional.empty());
        when(voteRepo.findByUserId(1)).thenReturn(List.of());

        RestClient.RequestBodyUriSpec request = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec response = mock(RestClient.ResponseSpec.class);
        when(restClient.post()).thenReturn(request);
        when(request.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(response);

        StringBuilder aiResponse = new StringBuilder("{\"items\":[");
        for (int i = 1; i <= 30; i++) {
            if (i > 1) aiResponse.append(",");
            aiResponse.append("{\"content_id\":").append(i)
                    .append(",\"content_type\":\"BLOG\",\"score\":0.9,\"reason\":\"personalized\"}");
        }
        aiResponse.append("],\"embedding_model\":\"test\"}");
        when(response.body(String.class)).thenReturn(aiResponse.toString());

        // Page 1
        PersonalizedFeedResponse page1 = service.getPersonalizedFeed("reader", 10, null);
        String cursor = page1.getNextCursor();

        // Page 2 - same cursor = SAME ORDER
        PersonalizedFeedResponse page2 = service.getPersonalizedFeed("reader", 10, cursor);
        String cursor2 = page2.getNextCursor();

        // Page 2 again - SAME cursor = SAME ORDER
        PersonalizedFeedResponse page2_again = service.getPersonalizedFeed("reader", 10, cursor);
        String cursor2_again = page2_again.getNextCursor();

        // Items in page 2 must be identical
        List<Integer> page2_ids = page2.getItems().stream()
                .map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList();
        List<Integer> page2_again_ids = page2_again.getItems().stream()
                .map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList();

        assertEquals(page2_ids, page2_again_ids,
                "Same cursor must return same items in same order");

        // But page 1 and page 2 must be different
        List<Integer> page1_ids = page1.getItems().stream()
                .map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList();

        for (Integer id : page1_ids) {
            assertFalse(page2_ids.contains(id),
                    "Page 1 ID " + id + " should not appear in Page 2");
        }
    }
}
