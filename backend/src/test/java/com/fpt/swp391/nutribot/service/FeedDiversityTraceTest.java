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
 * TRACE TEST: 10 lần refresh liên tiếp - chi tiết generation và rotation
 *
 * Root cause investigation cho NB-70: "F5 không thay đổi thứ tự"
 */
class FeedDiversityTraceTest {
    private ContentRepository contentRepository;
    private UserRepository userRepository;
    private UserProfileRepository userProfileRepository;
    private RestClient restClient;
    private PersonalizedFeedService service;
    private Map<Integer, Content> catalogMap;

    @BeforeEach
    void setUp() {
        contentRepository = mock(ContentRepository.class);
        userRepository = mock(UserRepository.class);
        userProfileRepository = mock(UserProfileRepository.class);
        restClient = mock(RestClient.class);
        service = new PersonalizedFeedService(contentRepository, userRepository,
                userProfileRepository, mock(VoteRepository.class), restClient, new ObjectMapper());
    }

    @Test
    @DisplayName("TRACE: 10 refresh với AI trả 50 items - chi tiết score distribution")
    void trace10Refreshes_ai50Items() {
        // Setup user
        User user = User.builder().userId(73).username("tracer").status(AccountStatus.ACTIVE).build();
        when(userRepository.findByUsername("tracer")).thenReturn(Optional.of(user));

        // Create 117 items với timestamps khác nhau (như production)
        List<Content> catalog = new ArrayList<>();
        for (int i = 1; i <= 117; i++) {
            User author = User.builder().userId(1).username("author").status(AccountStatus.ACTIVE).build();
            catalog.add(Content.builder()
                    .contentId(i)
                    .contentType("BLOG")
                    .status("published")
                    .title("Post " + i)
                    .body("Content " + i)
                    .slug("post-" + i)
                    .viewCount(100 - i)  // Giảm viewCount theo ID
                    .createdAt(LocalDateTime.of(2026, 1, 1, 0, 0).plusMinutes(i))
                    .user(author)
                    .build());
        }
        catalogMap = catalog.stream().collect(Collectors.toMap(Content::getContentId, c -> c));

        when(contentRepository.findPublicCatalogForRecommendation(eq("published"), any())).thenReturn(catalog);
        when(contentRepository.findPublicByIds(anyList(), eq("published")))
                .thenAnswer(inv -> inv.getArgument(0, List.class).stream()
                        .map(catalogMap::get).filter(Objects::nonNull).toList());

        // AI trả 50 items với score distribution thực tế
        stubAiResponse50Items();

        // TRACE: 10 refreshes
        List<List<Integer>> top20Lists = new ArrayList<>();
        List<List<Integer>> top10Lists = new ArrayList<>();
        List<List<Integer>> top5Lists = new ArrayList<>();

        System.out.println("\n=== TRACE 10 REFRESHES (AI 50 items) ===");
        for (int refresh = 0; refresh < 10; refresh++) {
            PersonalizedFeedResponse response = service.getPersonalizedFeed("tracer", 10, null);
            List<Integer> top20 = response.getItems().stream()
                    .map(PersonalizedFeedResponse.FeedItemResponse::getContentId)
                    .limit(20)
                    .toList();
            List<Integer> top10 = response.getItems().stream()
                    .map(PersonalizedFeedResponse.FeedItemResponse::getContentId)
                    .limit(10)
                    .toList();

            top20Lists.add(top20);
            top10Lists.add(top10);

            System.out.printf("Refresh %d: top10=%s, total=%d%n",
                    refresh, top10, response.getTotal());
        }

        // VERIFY: Các refresh phải khác nhau
        System.out.println("\n=== VERIFICATION ===");
        int differentTop10 = 0;
        for (int i = 1; i < top10Lists.size(); i++) {
            if (!top10Lists.get(i).equals(top10Lists.get(i-1))) {
                differentTop10++;
            }
        }
        System.out.printf("Top10 changes: %d/9 refreshes (expect > 0)%n", differentTop10);
        assertTrue(differentTop10 > 0, "Top10 must change between refreshes!");

        // Kiểm tra tổng
        PersonalizedFeedResponse lastResponse = service.getPersonalizedFeed("tracer", 20, null);
        assertEquals(117, lastResponse.getTotal(), "Total must be 117");

        // Kiểm tra pagination không duplicate
        Set<Integer> allIds = new HashSet<>();
        String cursor = null;
        int pages = 0;
        do {
            PersonalizedFeedResponse page = service.getPersonalizedFeed("tracer", 20, cursor);
            for (var item : page.getItems()) {
                assertTrue(allIds.add(item.getContentId()), "DUPLICATE: " + item.getContentId());
            }
            cursor = page.getNextCursor();
            pages++;
        } while (cursor != null && pages < 10);
        assertEquals(117, allIds.size(), "Must have 117 unique items");
    }

    @Test
    @DisplayName("TRACE: 10 refresh với AI trả ít items (24 như user:61)")
    void trace10Refreshes_ai24Items() {
        // Setup user
        User user = User.builder().userId(61).username("user61").status(AccountStatus.ACTIVE).build();
        when(userRepository.findByUsername("user61")).thenReturn(Optional.of(user));

        // Create 117 items
        List<Content> catalog = new ArrayList<>();
        for (int i = 1; i <= 117; i++) {
            User author = User.builder().userId(1).username("author").status(AccountStatus.ACTIVE).build();
            catalog.add(Content.builder()
                    .contentId(i)
                    .contentType("BLOG")
                    .status("published")
                    .title("Post " + i)
                    .body("Content " + i)
                    .slug("post-" + i)
                    .viewCount(100 - i)
                    .createdAt(LocalDateTime.of(2026, 1, 1, 0, 0).plusMinutes(i))
                    .user(author)
                    .build());
        }
        catalogMap = catalog.stream().collect(Collectors.toMap(Content::getContentId, c -> c));

        when(contentRepository.findPublicCatalogForRecommendation(eq("published"), any())).thenReturn(catalog);
        when(contentRepository.findPublicByIds(anyList(), eq("published")))
                .thenAnswer(inv -> inv.getArgument(0, List.class).stream()
                        .map(catalogMap::get).filter(Objects::nonNull).toList());

        // AI chỉ trả 24 items (như user:61 production)
        stubAiResponse24Items();

        System.out.println("\n=== TRACE 10 REFRESHES (AI 24 items) ===");
        List<List<Integer>> top10Lists = new ArrayList<>();
        List<List<Integer>> top5Lists = new ArrayList<>();
        for (int refresh = 0; refresh < 10; refresh++) {
            PersonalizedFeedResponse response = service.getPersonalizedFeed("user61", 10, null);
            List<Integer> top10 = response.getItems().stream()
                    .map(PersonalizedFeedResponse.FeedItemResponse::getContentId)
                    .limit(10)
                    .toList();
            top10Lists.add(top10);
            List<Integer> top5 = top10.stream().limit(5).toList();
            top5Lists.add(top5);
            List<Integer> previousTop5 = refresh == 0 ? List.of() : top5Lists.get(refresh - 1);
            int newInTop5 = refresh == 0 ? top5.size() : (int) top5.stream()
                    .filter(id -> !previousTop5.contains(id)).count();
            System.out.printf("Refresh %d: top10=%s, newInTop5=%d, total=%d%n",
                    refresh + 1, top10, newInTop5, response.getTotal());
            assertEquals(117, response.getTotal(), "AI only ranks; snapshot must retain all catalog content");
            assertTrue(response.getItems().stream()
                            .filter(item -> item.getContentId() <= 24)
                            .allMatch(item -> "personalized".equals(item.getRecommendationReason())),
                    "Every AI-ranked item that appears in the feed must keep its personalization reason");
        }

        // Kiểm tra
        System.out.println("\n=== VERIFICATION ===");
        int differentTop10 = 0;
        for (int i = 1; i < top10Lists.size(); i++) {
            if (!top10Lists.get(i).equals(top10Lists.get(i-1))) {
                differentTop10++;
            }
        }
        System.out.printf("Top10 changes: %d/9 refreshes%n", differentTop10);

        // Vẫn phải đủ 117 items
        for (int refresh = 1; refresh < top5Lists.size(); refresh++) {
            List<Integer> previousTop5 = top5Lists.get(refresh - 1);
            int newInTop5 = (int) top5Lists.get(refresh).stream()
                    .filter(id -> !previousTop5.contains(id)).count();
            assertEquals(5, newInTop5,
                    "Refresh " + (refresh + 1) + " must introduce five previously unfeatured IDs in top 5");
        }
        assertEquals(100, top10Lists.stream().flatMap(List::stream).collect(Collectors.toSet()).size(),
                "Ten refreshes must not repeat a content ID in the featured top 10");

        Set<Integer> allIds = new HashSet<>();
        String cursor = null;
        do {
            PersonalizedFeedResponse page = service.getPersonalizedFeed("user61", 20, cursor);
            page.getItems().forEach(item -> assertTrue(allIds.add(item.getContentId()),
                    "Duplicate ID in snapshot pagination: " + item.getContentId()));
            cursor = page.getNextCursor();
        } while (cursor != null);
        assertEquals(117, allIds.size(), "Snapshot must contain all 117 catalog IDs exactly once");
    }

    @Test
    @DisplayName("TRACE: Generation overflow scenario")
    void traceGenerationOverflow() {
        User user = User.builder().userId(74).username("genoverflow").status(AccountStatus.ACTIVE).build();
        when(userRepository.findByUsername("genoverflow")).thenReturn(Optional.of(user));

        // Small catalog để dễ trace
        List<Content> catalog = new ArrayList<>();
        for (int i = 1; i <= 10; i++) {
            User author = User.builder().userId(1).username("author").status(AccountStatus.ACTIVE).build();
            catalog.add(Content.builder()
                    .contentId(i)
                    .contentType("BLOG")
                    .status("published")
                    .title("Post " + i)
                    .body("Content " + i)
                    .slug("post-" + i)
                    .viewCount(0)
                    .createdAt(LocalDateTime.of(2026, 1, 1, 0, 0).plusMinutes(i))
                    .user(author)
                    .build());
        }
        catalogMap = catalog.stream().collect(Collectors.toMap(Content::getContentId, c -> c));

        when(contentRepository.findPublicCatalogForRecommendation(eq("published"), any())).thenReturn(catalog);
        when(contentRepository.findPublicByIds(anyList(), eq("published")))
                .thenAnswer(inv -> inv.getArgument(0, List.class).stream()
                        .map(catalogMap::get).filter(Objects::nonNull).toList());

        // AI trả items có similar scores (small gaps)
        stubAiResponseSimilarScores();

        System.out.println("\n=== TRACE GENERATION OVERFLOW (100 refreshes) ===");
        List<List<Integer>> top5Lists = new ArrayList<>();
        for (int refresh = 0; refresh < 100; refresh++) {
            PersonalizedFeedResponse response = service.getPersonalizedFeed("genoverflow", 5, null);
            List<Integer> top5 = response.getItems().stream()
                    .map(PersonalizedFeedResponse.FeedItemResponse::getContentId)
                    .limit(5)
                    .toList();
            top5Lists.add(top5);

            if (refresh < 10 || refresh % 20 == 0) {
                System.out.printf("Refresh %d: top5=%s%n", refresh, top5);
            }
        }

        // Check pattern
        System.out.println("\n=== PATTERN ANALYSIS ===");
        Map<List<Integer>, Integer> patternCounts = new HashMap<>();
        for (List<Integer> top5 : top5Lists) {
            patternCounts.merge(top5, 1, Integer::sum);
        }
        System.out.printf("Unique patterns in 100 refreshes: %d%n", patternCounts.size());
        patternCounts.entrySet().stream()
                .sorted(Map.Entry.<List<Integer>, Integer>comparingByValue().reversed())
                .limit(5)
                .forEach(e -> System.out.printf("  Pattern %s: %d times%n", e.getKey(), e.getValue()));
    }

    private void stubAiResponse50Items() {
        // Score distribution thực tế với gaps lớn ở top
        double[] scores = {
                0.948, 0.728, 0.567, 0.358, 0.195, -0.006, -0.185, -0.372, -0.565, -0.744,
                -0.926, -1.104, -1.294, -1.475, -1.663, -1.848, -2.031, -2.217, -2.402, -2.588,
                -2.771, -2.957, -3.143, -3.326, -3.511, -3.698, -3.881, -4.067, -4.252, -4.439,
                -4.623, -4.808, -4.993, -5.178, -5.362, -5.548, -5.733, -5.918, -6.103, -6.288,
                -6.473, -6.658, -6.843, -7.028, -7.214, -7.699, -8.184, -8.669, -9.154, -9.644
        };
        StringBuilder json = new StringBuilder("{\"items\":[");
        for (int i = 0; i < 50; i++) {
            if (i > 0) json.append(',');
            json.append(String.format(
                    "{\"content_id\":%d,\"content_type\":\"BLOG\",\"score\":%.6f,\"reason\":\"personalized\"}",
                    i + 1, scores[i]));
        }
        json.append("],\"embedding_model\":\"test\"}");
        stubAiResponse(json.toString());
    }

    private void stubAiResponse24Items() {
        double[] scores = {
                0.948, 0.728, 0.567, 0.358, 0.195, -0.006, -0.185, -0.372, -0.565, -0.744,
                -0.926, -1.104, -1.294, -1.475, -1.663, -1.848, -2.031, -2.217, -2.402, -2.588,
                -2.771, -2.957, -3.143, -3.326
        };
        StringBuilder json = new StringBuilder("{\"items\":[");
        for (int i = 0; i < 24; i++) {
            if (i > 0) json.append(',');
            json.append(String.format(
                    "{\"content_id\":%d,\"content_type\":\"BLOG\",\"score\":%.6f,\"reason\":\"personalized\"}",
                    i + 1, scores[i]));
        }
        json.append("],\"embedding_model\":\"test\"}");
        stubAiResponse(json.toString());
    }

    private void stubAiResponseSimilarScores() {
        // 10 items với very small gaps để test rotation
        StringBuilder json = new StringBuilder("{\"items\":[");
        for (int i = 0; i < 10; i++) {
            if (i > 0) json.append(',');
            double score = 1.0 - (i * 0.01);  // 1.0, 0.99, 0.98, ...
            json.append(String.format(
                    "{\"content_id\":%d,\"content_type\":\"BLOG\",\"score\":%.6f,\"reason\":\"personalized\"}",
                    i + 1, score));
        }
        json.append("],\"embedding_model\":\"test\"}");
        stubAiResponse(json.toString());
    }

    private void stubAiResponse(String responseBody) {
        RestClient.RequestBodyUriSpec requestSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec response = mock(RestClient.ResponseSpec.class);
        when(restClient.post()).thenReturn(requestSpec);
        when(requestSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(response);
        when(response.body(String.class)).thenReturn(responseBody);
    }
}
