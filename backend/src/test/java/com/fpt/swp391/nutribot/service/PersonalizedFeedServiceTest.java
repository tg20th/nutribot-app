package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.request.RecommendationRequestDto;
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
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PersonalizedFeedServiceTest {
    private ContentRepository contentRepository;
    private UserRepository userRepository;
    private RestClient restClient;
    private PersonalizedFeedService service;
    private Map<Integer, Content> visibleContents = Map.of();

    @BeforeEach
    void setUp() {
        contentRepository = mock(ContentRepository.class);
        userRepository = mock(UserRepository.class);
        restClient = mock(RestClient.class);
        service = new PersonalizedFeedService(contentRepository, userRepository,
                mock(UserProfileRepository.class), mock(VoteRepository.class), restClient, new ObjectMapper());
    }

    @Test
    void guestGetsNewestPublicContentAndCursorDoesNotDuplicateOrSkip() {
        stubCatalog(List.of(
                content(1, LocalDateTime.of(2026, 1, 1, 10, 0)),
                content(3, LocalDateTime.of(2026, 1, 3, 10, 0)),
                content(2, LocalDateTime.of(2026, 1, 2, 10, 0))));

        PersonalizedFeedResponse first = service.getPersonalizedFeed(null, 2, null);
        PersonalizedFeedResponse second = service.getPersonalizedFeed(null, 2, first.getNextCursor());

        List<Integer> allIds = new java.util.ArrayList<>();
        allIds.addAll(first.getItems().stream().map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList());
        allIds.addAll(second.getItems().stream().map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList());
        assertEquals(3, allIds.size());
        assertEquals(java.util.Set.of(1, 2, 3), new java.util.HashSet<>(allIds));
        assertTrue(first.getFallback());
        assertNull(second.getNextCursor());
        verifyNoInteractions(restClient);
    }

    @Test
    void guestPaginatesAllFiftyEligibleContentsWithoutCallingAi() {
        stubCatalog(fiftyContents());

        List<Integer> ids = collectAllPages(null);

        assertEquals(50, ids.size());
        assertEquals(50, new java.util.HashSet<>(ids).size());
        verifyNoInteractions(restClient);
    }

    @Test
    void refreshBuildsANewSnapshotAndIncludesNewlyPublishedContent() {
        stubCatalog(fiftyContents());
        PersonalizedFeedResponse beforeRefresh = service.getPersonalizedFeed(null, 10, null);
        List<Content> refreshedCatalog = new java.util.ArrayList<>(fiftyContents());
        refreshedCatalog.add(content(51, LocalDateTime.of(2026, 1, 1, 0, 0).plusMinutes(51)));
        stubCatalog(refreshedCatalog);

        PersonalizedFeedResponse afterRefresh = service.getPersonalizedFeed(null, 10, null);

        assertFalse(beforeRefresh.getItems().stream().map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList().contains(51));
        assertEquals(51, afterRefresh.getItems().get(0).getContentId());
        assertEquals(51, afterRefresh.getTotal());
    }

    @Test
    void aiFailureStillPaginatesAllFiftyEligibleContents() {
        User user = User.builder().userId(9).username("reader").status(AccountStatus.ACTIVE).build();
        when(userRepository.findByUsername("reader")).thenReturn(java.util.Optional.of(user));
        stubCatalog(fiftyContents());
        when(restClient.post()).thenThrow(new RuntimeException("AI offline"));

        List<Integer> ids = collectAllPages("reader");

        assertEquals(50, ids.size());
        assertEquals(50, new java.util.HashSet<>(ids).size());
    }

    @Test
    void aiFailureFallsBackToAllNewestEligibleContentInsteadOfEmptyFeed() {
        User user = User.builder().userId(9).username("reader").status(AccountStatus.ACTIVE).build();
        when(userRepository.findByUsername("reader")).thenReturn(java.util.Optional.of(user));
        stubCatalog(List.of(
                content(1, LocalDateTime.of(2026, 1, 1, 10, 0)),
                content(2, LocalDateTime.of(2026, 1, 2, 10, 0)),
                content(3, LocalDateTime.of(2026, 1, 3, 10, 0))));
        when(restClient.post()).thenThrow(new RuntimeException("AI offline"));

        PersonalizedFeedResponse response = service.getPersonalizedFeed("reader", 2, null);

        assertTrue(response.getFallback());
        assertEquals(List.of(3, 2), response.getItems().stream().map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList());
        assertNotNull(response.getNextCursor());
    }

    @Test
    void fallbackRefreshRotatesOnlyEquivalentRecencyTierAndCursorKeepsSnapshot() {
        User user = User.builder().userId(71).username("diversity-reader").status(AccountStatus.ACTIVE).build();
        when(userRepository.findByUsername("diversity-reader")).thenReturn(java.util.Optional.of(user));
        stubCatalog(fiftyContents());
        when(restClient.post()).thenThrow(new RuntimeException("AI offline"));

        List<PersonalizedFeedResponse> refreshes = new java.util.ArrayList<>();
        for (int refresh = 0; refresh < 10; refresh++) {
            refreshes.add(service.getPersonalizedFeed("diversity-reader", 10, null));
        }

        List<List<Integer>> topTens = refreshes.stream()
                .map(response -> response.getItems().stream()
                        .map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList())
                .toList();
        assertEquals(10, topTens.size());
        assertTrue(topTens.stream().flatMap(List::stream).allMatch(id -> id >= 31));
        for (int index = 1; index < topTens.size(); index++) {
            assertNotEquals(topTens.get(index - 1), topTens.get(index),
                    "Refresh " + index + " must not repeat the preceding top-10 while its tier has 20 candidates");
        }

        PersonalizedFeedResponse first = refreshes.getFirst();
        List<Integer> firstIds = topTens.getFirst();
        PersonalizedFeedResponse pageTwo = service.getPersonalizedFeed("diversity-reader", 10, first.getNextCursor());
        PersonalizedFeedResponse pageTwoAgain = service.getPersonalizedFeed("diversity-reader", 10, first.getNextCursor());
        assertEquals(pageTwo.getItems().stream().map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList(),
                pageTwoAgain.getItems().stream().map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList());
        assertTrue(java.util.Collections.disjoint(firstIds,
                pageTwo.getItems().stream().map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList()));
    }

    @Test
    void personalizedRefreshDoesNotFreezeAfterAllEquivalentAiCandidatesBecomeRecent() {
        User user = User.builder().userId(72).username("personalized-reader").status(AccountStatus.ACTIVE).build();
        when(userRepository.findByUsername("personalized-reader")).thenReturn(java.util.Optional.of(user));
        stubCatalog(contents(114));
        stubAiResponse(personalizedObservedScoreResponse());

        List<List<Integer>> topTens = new java.util.ArrayList<>();
        List<String> reasons = new java.util.ArrayList<>();
        for (int refresh = 0; refresh < 10; refresh++) {
            PersonalizedFeedResponse response = service.getPersonalizedFeed("personalized-reader", 10, null);
            topTens.add(response.getItems().stream()
                    .map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList());
            reasons.addAll(response.getItems().stream()
                    .map(PersonalizedFeedResponse.FeedItemResponse::getRecommendationReason).toList());
        }

        assertTrue(reasons.stream().allMatch("personalized"::equals));
        for (int index = 1; index < topTens.size(); index++) {
            assertNotEquals(topTens.get(index - 1), topTens.get(index),
                    "Personalized refresh must keep rotating after every candidate in its score tier is RECENT");
        }

        // Logout removes the client credential, not account-owned feed history. A guest request
        // must therefore neither reset nor inherit user:72's tracker before the same user returns.
        service.getPersonalizedFeed(null, 10, null);
        PersonalizedFeedResponse afterLogin = service.getPersonalizedFeed("personalized-reader", 10, null);
        List<Integer> afterLoginTopTen = afterLogin.getItems().stream()
                .map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList();
        assertNotEquals(topTens.getLast(), afterLoginTopTen);
        assertTrue(afterLogin.getItems().stream()
                .allMatch(item -> "personalized".equals(item.getRecommendationReason())));

        PersonalizedFeedResponse first = service.getPersonalizedFeed("personalized-reader", 10, null);
        List<Integer> pagedIds = new java.util.ArrayList<>(first.getItems().stream()
                .map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList());
        String cursor = first.getNextCursor();
        while (cursor != null) {
            PersonalizedFeedResponse page = service.getPersonalizedFeed("personalized-reader", 10, cursor);
            pagedIds.addAll(page.getItems().stream().map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList());
            cursor = page.getNextCursor();
        }
        assertEquals(114, pagedIds.size());
        assertEquals(114, new java.util.HashSet<>(pagedIds).size());
    }

    @Test
    void contentCandidateSerializesMissingTagMetadataAsEmptyArraysForAiContract() throws Exception {
        var method = PersonalizedFeedService.class.getDeclaredMethod("toContentCandidate", Content.class);
        method.setAccessible(true);
        RecommendationRequestDto.ContentCandidateDto candidate =
                (RecommendationRequestDto.ContentCandidateDto) method.invoke(service, content(1, LocalDateTime.now()));

        JsonNode payload = new ObjectMapper().valueToTree(candidate);

        assertTrue(payload.path("tags").isArray());
        assertTrue(payload.path("ingredients").isArray());
        assertTrue(payload.path("dietary_tags").isArray());
        assertEquals(0, payload.path("tags").size());
        assertEquals(0, payload.path("ingredients").size());
        assertEquals(0, payload.path("dietary_tags").size());
    }

    @Test
    void memberAiRecommendationsThenNewestFallbackPaginateAllFiftyUniqueContents() throws Exception {
        User user = User.builder().userId(9).username("reader").status(AccountStatus.ACTIVE).build();
        when(userRepository.findByUsername("reader")).thenReturn(java.util.Optional.of(user));
        stubCatalog(fiftyContents());
        stubAiResponse("""
                {"items":[
                  {"content_id":1,"content_type":"BLOG","score":0.9,"reason":"personalized"},
                  {"content_id":2,"content_type":"BLOG","score":0.8,"reason":"personalized"}
                ],"embedding_model":"test"}
                """);

        List<Integer> ids = collectAllPages("reader");

        assertEquals(50, ids.size());
        assertEquals(50, new java.util.HashSet<>(ids).size());
        assertEquals(1, ids.get(0));
        ArgumentCaptor<Object> bodyCaptor = ArgumentCaptor.forClass(Object.class);
        verify(aiBodySpec, atLeastOnce()).body(bodyCaptor.capture());
        JsonNode request = new ObjectMapper().readTree((String) bodyCaptor.getValue());
        assertEquals(50, request.path("limit").asInt());
        assertEquals(50, request.path("contents").size());
    }

    @Test
    void emptyAiResponseFallsBackAndPaginatesAllFiftyUniqueContents() {
        User user = User.builder().userId(9).username("reader").status(AccountStatus.ACTIVE).build();
        when(userRepository.findByUsername("reader")).thenReturn(java.util.Optional.of(user));
        stubCatalog(fiftyContents());
        stubAiResponse("{\"items\":[],\"embedding_model\":\"test\"}");

        List<Integer> ids = collectAllPages("reader");

        assertEquals(50, ids.size());
        assertEquals(50, new java.util.HashSet<>(ids).size());
    }

    private RestClient.RequestBodySpec aiBodySpec;

    private void stubAiResponse(String responseBody) {
        RestClient.RequestBodyUriSpec request = mock(RestClient.RequestBodyUriSpec.class);
        aiBodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec response = mock(RestClient.ResponseSpec.class);
        when(restClient.post()).thenReturn(request);
        when(request.uri(anyString())).thenReturn(aiBodySpec);
        when(aiBodySpec.contentType(any(MediaType.class))).thenReturn(aiBodySpec);
        when(aiBodySpec.body(any(Object.class))).thenReturn(aiBodySpec);
        when(aiBodySpec.retrieve()).thenReturn(response);
        when(response.body(String.class)).thenReturn(responseBody);
    }

    /**
     * Scores captured from the authenticated NB-70 trace. They are adjusted
     * ranking scores, so they deliberately cross zero and are not probabilities.
     */
    private String personalizedObservedScoreResponse() {
        double[] scores = {
                0.948, 0.728, 0.567, 0.358, 0.195, -0.006, -0.185, -0.372, -0.565, -0.744,
                -0.926, -1.104, -1.294, -1.475, -1.663, -1.848, -2.031, -2.217, -2.402, -2.588,
                -2.771, -2.957, -3.143, -3.326, -3.511, -3.698, -3.881, -4.067, -4.252, -4.439,
                -4.623, -4.808, -4.993, -5.178, -5.362, -5.548, -5.733, -5.918, -6.103, -6.288,
                -6.473, -6.658, -6.843, -7.028, -7.214, -7.699, -8.184, -8.669, -9.154, -9.644
        };
        StringBuilder response = new StringBuilder("{\"items\":[");
        for (int id = 1; id <= scores.length; id++) {
            if (id > 1) response.append(',');
            response.append("{\"content_id\":").append(id)
                    .append(",\"content_type\":\"BLOG\",\"score\":").append(scores[id - 1])
                    .append(",\"reason\":\"personalized\"}");
        }
        return response.append("],\"embedding_model\":\"test\"}").toString();
    }

    private List<Integer> collectAllPages(String username) {
        java.util.ArrayList<Integer> ids = new java.util.ArrayList<>();
        String cursor = null;
        do {
            PersonalizedFeedResponse page = service.getPersonalizedFeed(username, 10, cursor);
            assertEquals(10, page.getItems().size());
            ids.addAll(page.getItems().stream().map(PersonalizedFeedResponse.FeedItemResponse::getContentId).toList());
            cursor = page.getNextCursor();
        } while (cursor != null);
        return ids;
    }

    private List<Content> fiftyContents() {
        return contents(50);
    }

    private List<Content> contents(int count) {
        java.util.ArrayList<Content> contents = new java.util.ArrayList<>();
        for (int id = 1; id <= count; id++) {
            contents.add(content(id, LocalDateTime.of(2026, 1, 1, 0, 0).plusMinutes(id)));
        }
        return contents;
    }

    private void stubCatalog(List<Content> contents) {
        visibleContents = contents.stream().collect(Collectors.toMap(Content::getContentId, content -> content));
        when(contentRepository.findPublicCatalogForRecommendation(anyString(), any())).thenReturn(contents);
        when(contentRepository.findPublicByIds(anyList(), eq("published"))).thenAnswer(invocation -> {
            List<Integer> ids = invocation.getArgument(0);
            return ids.stream().map(visibleContents::get).filter(java.util.Objects::nonNull).toList();
        });
    }

    private Content content(int id, LocalDateTime createdAt) {
        return Content.builder().contentId(id).contentType("BLOG").status("published")
                .title("Healthy tofu " + id).body("tofu vegetables").slug("post-" + id)
                .viewCount(0).createdAt(createdAt)
                .user(User.builder().userId(1).username("author").status(AccountStatus.ACTIVE).build()).build();
    }
}
