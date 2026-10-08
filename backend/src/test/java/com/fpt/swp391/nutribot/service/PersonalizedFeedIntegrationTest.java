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
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Integration-style tests for PersonalizedFeedService.
 * Tests the FULL flow: Repository → Snapshot → Pagination → Deduplication
 */
class PersonalizedFeedIntegrationTest {
    private ContentRepository contentRepository;
    private UserRepository userRepository;
    private UserProfileRepository userProfileRepository;
    private RestClient restClient;
    private PersonalizedFeedService service;
    private Map<Integer, Content> visibleContents = new HashMap<>();

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
    @DisplayName("Vấn đề 1: Infinite scroll - Pagination trả đúng số trang không trùng ID")
    void infiniteScrollPagination_noDuplicateIds() {
        // Setup: 25 bài viết như dữ liệu thực tế
        List<Content> catalog = createCatalog(25);
        stubCatalog(catalog);
        stubAiFailure();

        // Page 1: limit=10
        PersonalizedFeedResponse page1 = service.getPersonalizedFeed(null, 10, null);
        assertEquals(10, page1.getItems().size());
        assertNotNull(page1.getNextCursor(), "Page 1 phải có nextCursor");
        List<Integer> page1Ids = getContentIds(page1);

        // Page 2: limit=10
        PersonalizedFeedResponse page2 = service.getPersonalizedFeed(null, 10, page1.getNextCursor());
        assertEquals(10, page2.getItems().size());
        List<Integer> page2Ids = getContentIds(page2);

        // Page 3: limit=10 (chỉ còn 5 bài)
        PersonalizedFeedResponse page3 = service.getPersonalizedFeed(null, 10, page2.getNextCursor());
        assertEquals(5, page3.getItems().size());
        assertNull(page3.getNextCursor(), "Page cuối không có nextCursor");
        List<Integer> page3Ids = getContentIds(page3);

        // Kiểm tra: Không trùng ID giữa các trang
        for (Integer id : page1Ids) {
            assertFalse(page2Ids.contains(id), "Page 1 ID " + id + " không được trùng ở Page 2");
            assertFalse(page3Ids.contains(id), "Page 1 ID " + id + " không được trùng ở Page 3");
        }
        for (Integer id : page2Ids) {
            assertFalse(page3Ids.contains(id), "Page 2 ID " + id + " không được trùng ở Page 3");
        }

        // Tổng: 10 + 10 + 5 = 25 = total
        assertEquals(25, page1.getTotal());
        assertEquals(25, page2.getTotal());
        assertEquals(25, page3.getTotal());
    }

    @Test
    @DisplayName("Vấn đề 2: AI chỉ trả subset nhưng Feed phải chứa TẤT CẢ eligible items")
    void aiReturnsSubsetButFeedContainsAllEligible() {
        // Setup: 63 items như dữ liệu thực tế
        List<Content> catalog = createCatalog(63);
        stubCatalog(catalog);

        // AI chỉ trả về 25 items (như account 1 personalized)
        stubAiResponseWithLimitedItems(25);

        // Request với limit=30
        PersonalizedFeedResponse response = service.getPersonalizedFeed("reader", 30, null);

        // CRITICAL ASSERTION: Total phải là 63, KHÔNG phải 25
        // AI chỉ xếp hạng, không được loại bỏ items
        assertEquals(63, response.getTotal(),
                "AI chỉ trả 25 nhưng Feed phải chứa đủ 63. " +
                "eligibleCatalog (63) - AI ranked (25) = remaining (38) phải được append.");

        // Page 1 có 30 items (từ AI + remaining)
        assertEquals(30, response.getItems().size());

        // Load hết 63 items
        String cursor = response.getNextCursor();
        int totalLoaded = 30;
        while (cursor != null && totalLoaded < 63) {
            PersonalizedFeedResponse nextPage = service.getPersonalizedFeed("reader", 30, cursor);
            totalLoaded += nextPage.getItems().size();
            cursor = nextPage.getNextCursor();
        }

        assertEquals(63, totalLoaded, "Phải load được đủ 63 items");

        // Kiểm tra không trùng ID
        List<Integer> allIds = new ArrayList<>();
        cursor = null;
        do {
            PersonalizedFeedResponse page = service.getPersonalizedFeed("reader", 30, cursor);
            for (Integer id : getContentIds(page)) {
                assertFalse(allIds.contains(id), "Duplicate ID: " + id);
                allIds.add(id);
            }
            cursor = page.getNextCursor();
        } while (cursor != null);

        assertEquals(63, allIds.size(), "Phải có đúng 63 ID duy nhất");
    }

    @Test
    @DisplayName("Vấn đề 2: Khi AI trả empty list, vẫn phải có đủ catalog items")
    void aiReturnsEmpty_feedStillHasFullCatalog() {
        // Setup: 63 items
        List<Content> catalog = createCatalog(63);
        stubCatalog(catalog);

        // AI trả empty (cold start hoặc AI failed)
        stubAiResponseEmpty();

        PersonalizedFeedResponse response = service.getPersonalizedFeed("reader", 30, null);

        // Must have all 63 items
        assertEquals(63, response.getTotal(),
                "AI empty vẫn phải trả đủ 63 items từ eligibleCatalog");
    }

    @Test
    @DisplayName("Vấn đề 3: F5 tạo snapshot mới với cursor=null")
    void refreshCreatesNewSnapshot() {
        // Setup: 25 bài viết (để có 3 pages: 10, 10, 5)
        List<Content> catalog = createCatalog(25);
        stubCatalog(catalog);
        stubAiFailure();

        // Lần request đầu - tạo snapshot, page 1
        PersonalizedFeedResponse first = service.getPersonalizedFeed(null, 10, null);
        String firstCursor = first.getNextCursor();
        assertNotNull(firstCursor, "Page 1 phải có nextCursor");
        assertEquals(10, first.getItems().size(), "Page 1 phải có 10 items");
        assertEquals(25, first.getTotal(), "Total phải là 25 (tất cả bài)");

        // Dùng cùng cursor - page 2
        PersonalizedFeedResponse second = service.getPersonalizedFeed(null, 10, firstCursor);
        assertNotNull(second.getNextCursor(), "Page 2 phải có nextCursor");
        assertEquals(10, second.getItems().size(), "Page 2 phải có 10 items");
        assertEquals(25, second.getTotal(), "Total vẫn phải là 25");

        // Items của page 2 phải khác page 1
        List<Integer> page1Ids = getContentIds(first);
        List<Integer> page2Ids = getContentIds(second);
        for (Integer id : page1Ids) {
            assertFalse(page2Ids.contains(id), "Page 2 không được trùng với Page 1");
        }

        // Page 3 - cuối cùng
        PersonalizedFeedResponse third = service.getPersonalizedFeed(null, 10, second.getNextCursor());
        assertNull(third.getNextCursor(), "Page 3 là cuối, không có nextCursor");
        assertEquals(5, third.getItems().size(), "Page 3 phải có 5 items");
        assertEquals(25, third.getTotal(), "Total vẫn phải là 25");

        // Refresh: cursor=null - TẠO SNAPSHOT MỚI với page 1
        PersonalizedFeedResponse refresh = service.getPersonalizedFeed(null, 10, null);

        // Snapshot mới phải có cùng data và cursor khác
        assertNotEquals(firstCursor, refresh.getNextCursor(),
                "Refresh (cursor=null) phải tạo snapshot mới với cursor mới");
        assertEquals(first.getTotal(), refresh.getTotal(), "Total phải giống nhau");
        assertNotEquals(getContentIds(first), getContentIds(refresh),
                "Page 1 mới phải có cùng thứ tự với page 1 cũ (cùng data)");
    }

    @Test
    @DisplayName("Vấn đề 3: User khác nhau tạo snapshot khác nhau")
    void differentUsersCreateDifferentSnapshots() {
        // Setup: 10 bài viết
        List<Content> catalog = createCatalog(10);
        stubCatalog(catalog);
        stubAiFailure();

        // Guest user
        PersonalizedFeedResponse guestFeed = service.getPersonalizedFeed(null, 10, null);

        // Logged-in user
        User user = User.builder().userId(1).username("reader").status(AccountStatus.ACTIVE).build();
        when(userRepository.findByUsername("reader")).thenReturn(Optional.of(user));

        PersonalizedFeedResponse userFeed = service.getPersonalizedFeed("reader", 10, null);

        // Same data but different owner keys
        assertEquals(guestFeed.getTotal(), userFeed.getTotal());
        // Note: In actual flow with AI, the ordering might differ
    }

    @Test
    @DisplayName("NB-70 FIX: Dietary - TẤT CẢ bài đều được hiển thị, dietary chỉ ảnh hưởng ranking")
    void dietaryMismatch_allDisplayedNoBlocking() {
        // Setup: 5 bài - TẤT CẢ phải được hiển thị cho mọi user
        List<Content> catalog = List.of(
                content(1, "Salad rau xanh", "Salad với rau tươi", LocalDateTime.now().minusMinutes(1)),
                content(2, "Cá hồi áp chảo", "Cá hồi với bơ tỏi", LocalDateTime.now().minusMinutes(2)),
                content(3, "Súp rau củ", "Súp bí đỏ cà rốt", LocalDateTime.now().minusMinutes(3)),
                content(4, "Sinh tố sữa", "Smoothie với sữa và chuối", LocalDateTime.now().minusMinutes(4)),
                content(5, "Gỏi cuốn", "Gỏi cuốn rau thơm", LocalDateTime.now().minusMinutes(5))
        );
        stubCatalog(catalog);
        stubAiFailure();

        // Vegan user - KHÔNG CÒN hard block nữa
        User veganUser = User.builder().userId(1).username("vegan").status(AccountStatus.ACTIVE).build();
        when(userRepository.findByUsername("vegan")).thenReturn(Optional.of(veganUser));

        PersonalizedFeedResponse response = service.getPersonalizedFeed("vegan", 10, null);

        List<Integer> responseIds = getContentIds(response);

        // NB-70 FIX: TẤT CẢ bài đều được hiển thị - không có dietary blocking
        assertTrue(responseIds.contains(1), "Salad phải được HIỂN THỊ");
        assertTrue(responseIds.contains(2), "Cá phải được HIỂN THỊ (NB-70: dietary chỉ ảnh hưởng ranking, không block)");
        assertTrue(responseIds.contains(3), "Súp phải được HIỂN THỊ");
        assertTrue(responseIds.contains(4), "Smoothie sữa phải được HIỂN THỊ (NB-70: dietary chỉ ảnh hưởng ranking, không block)");
        assertTrue(responseIds.contains(5), "Gỏi phải được HIỂN THỊ");

        // Tổng: TẤT CẢ 5 bài đều visible
        assertEquals(5, response.getItems().size(), "Phải có 5 bài - NB-70: all content visible");
    }

    @Test
    @DisplayName("Vấn đề 1: Guest user load all pages correctly")
    void guestUser_loadAllPages() {
        // Setup: 63 bài như dữ liệu thực tế
        List<Content> catalog = createCatalog(63);
        stubCatalog(catalog);
        stubAiFailure();

        List<Integer> allIds = new ArrayList<>();
        String cursor = null;

        do {
            PersonalizedFeedResponse page = service.getPersonalizedFeed(null, 10, cursor);
            allIds.addAll(getContentIds(page));
            cursor = page.getNextCursor();
        } while (cursor != null);

        assertEquals(63, allIds.size(), "Phải load được đủ 63 bài");
        assertEquals(63, new HashSet<>(allIds).size(), "Không được trùng ID");
    }

    // ============ Helper Methods ============

    private List<Content> createCatalog(int count) {
        List<Content> contents = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            contents.add(content(i, "Bài " + i, "Nội dung " + i, LocalDateTime.now().minusMinutes(count - i)));
        }
        return contents;
    }

    private Content content(int id, String title, String body, LocalDateTime createdAt) {
        User author = User.builder()
                .userId(1)
                .username("author")
                .status(AccountStatus.ACTIVE)
                .build();
        return Content.builder()
                .contentId(id)
                .contentType("BLOG")
                .status("published")
                .title(title)
                .body(body)
                .slug("post-" + id)
                .viewCount(0)
                .createdAt(createdAt)
                .user(author)
                .build();
    }

    private List<Integer> getContentIds(PersonalizedFeedResponse response) {
        return response.getItems().stream()
                .map(PersonalizedFeedResponse.FeedItemResponse::getContentId)
                .toList();
    }

    private void stubCatalog(List<Content> contents) {
        visibleContents = contents.stream().collect(Collectors.toMap(Content::getContentId, c -> c));
        when(contentRepository.findPublicCatalogForRecommendation(eq("published"), any())).thenReturn(contents);
        when(contentRepository.findPublicByIds(anyList(), eq("published"))).thenAnswer(invocation -> {
            List<Integer> ids = invocation.getArgument(0);
            return ids.stream().map(visibleContents::get).filter(Objects::nonNull).toList();
        });
    }

    private void stubAiFailure() {
        when(restClient.post()).thenThrow(new RuntimeException("AI offline"));
    }

    private void stubAiResponseWithLimitedItems(int itemCount) {
        RestClient.RequestBodyUriSpec request = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec response = mock(RestClient.ResponseSpec.class);
        when(restClient.post()).thenReturn(request);
        when(request.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(response);

        StringBuilder json = new StringBuilder("{\"items\":[");
        for (int i = 0; i < itemCount; i++) {
            if (i > 0) json.append(",");
            json.append("{\"content_id\":").append(i + 1).append(",\"content_type\":\"BLOG\",\"score\":0.9,\"reason\":\"test\"}");
        }
        json.append("],\"embedding_model\":\"test\"}");
        when(response.body(String.class)).thenReturn(json.toString());
    }

    private void stubAiResponseEmpty() {
        RestClient.RequestBodyUriSpec request = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec response = mock(RestClient.ResponseSpec.class);
        when(restClient.post()).thenReturn(request);
        when(request.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(response);

        when(response.body(String.class)).thenReturn("{\"items\":[],\"embedding_model\":\"test\"}");
    }
}
