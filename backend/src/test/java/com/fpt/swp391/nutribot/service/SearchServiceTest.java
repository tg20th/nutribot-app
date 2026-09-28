package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.ContentListResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.*;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("Kiểm thử SearchService (Task NB-15: Tìm kiếm Đa tiêu chí cho Blog & Video)")
class SearchServiceTest {

    private ContentRepository contentRepository;
    private SearchService searchService;

    @BeforeEach
    void setUp() {
        contentRepository = mock(ContentRepository.class);
        searchService = new SearchService(contentRepository);
    }

    private Content createSampleContent(int id, String type, String title, int views) {
        User author = User.builder()
                .userId(1)
                .username("author_1")
                .fullName("Nguyễn Tác Giả")
                .status(AccountStatus.ACTIVE)
                .build();

        return Content.builder()
                .contentId(id)
                .contentType(type)
                .status("published")
                .title(title)
                .slug("slug-" + id)
                .categoryId(2)
                .user(author)
                .viewCount(views)
                .createdAt(LocalDateTime.now().minusDays(id))
                .build();
    }

    @Test
    @DisplayName("Tìm kiếm với keyword có khoảng trắng -> trim chuẩn xác và mặc định sắp xếp mới nhất")
    void search_WithTrimmedKeywordAndNewestSort_QueriesCorrectly() {
        Content item = createSampleContent(10, "BLOG", "Công thức salad đậu hũ", 100);
        Page<Content> mockPage = new PageImpl<>(List.of(item), PageRequest.of(0, 10), 1);

        when(contentRepository.searchByKeyword(eq("%đậu hũ%"), eq("published"), any(Pageable.class)))
                .thenReturn(mockPage);

        PagedResponse<ContentListResponse> response = searchService.search("   đậu hũ   ", null, null, "newest", 0, 10);

        assertNotNull(response);
        assertEquals(1, response.getContent().size());
        assertEquals("Công thức salad đậu hũ", response.getContent().get(0).getTitle());
        assertEquals(1, response.getTotalElements());

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(contentRepository).searchByKeyword(eq("%đậu hũ%"), eq("published"), pageableCaptor.capture());

        Pageable captured = pageableCaptor.getValue();
        assertEquals(0, captured.getPageNumber());
        assertEquals(10, captured.getPageSize());

        Sort.Order firstOrder = captured.getSort().getOrderFor("createdAt");
        assertNotNull(firstOrder);
        assertTrue(firstOrder.isDescending());

        Sort.Order tieBreaker = captured.getSort().getOrderFor("contentId");
        assertNotNull(tieBreaker, "Phải có contentId làm tie-breaker để sort deterministic");
        assertTrue(tieBreaker.isDescending());
    }

    @Test
    @DisplayName("Sắp xếp theo 'popular' (lượt xem nhiều nhất) -> áp dụng sort viewCount DESC kèm tie-breaker")
    void search_WithPopularSort_SortsByViewCountAndTieBreaker() {
        Page<Content> emptyPage = new PageImpl<>(List.of());
        when(contentRepository.searchByKeyword(anyString(), anyString(), any(Pageable.class)))
                .thenReturn(emptyPage);

        searchService.search("chay", null, null, "popular", 0, 10);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(contentRepository).searchByKeyword(eq("%chay%"), eq("published"), pageableCaptor.capture());

        Pageable captured = pageableCaptor.getValue();
        Sort.Order viewOrder = captured.getSort().getOrderFor("viewCount");
        assertNotNull(viewOrder);
        assertTrue(viewOrder.isDescending());

        Sort.Order idOrder = captured.getSort().getOrderFor("contentId");
        assertNotNull(idOrder);
        assertTrue(idOrder.isDescending());
    }

    @Test
    @DisplayName("Sắp xếp theo 'oldest' -> áp dụng sort createdAt ASC kèm tie-breaker contentId ASC")
    void search_WithOldestSort_SortsByCreatedAtAsc() {
        Page<Content> emptyPage = new PageImpl<>(List.of());
        when(contentRepository.searchByKeyword(anyString(), anyString(), any(Pageable.class)))
                .thenReturn(emptyPage);

        searchService.search("chay", null, null, "oldest", 0, 10);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(contentRepository).searchByKeyword(eq("%chay%"), eq("published"), pageableCaptor.capture());

        Pageable captured = pageableCaptor.getValue();
        Sort.Order dateOrder = captured.getSort().getOrderFor("createdAt");
        assertNotNull(dateOrder);
        assertTrue(dateOrder.isAscending());

        Sort.Order idOrder = captured.getSort().getOrderFor("contentId");
        assertNotNull(idOrder);
        assertTrue(idOrder.isAscending());
    }

    @Test
    @DisplayName("Tham số page/size không hợp lệ (âm hoặc quá lớn) -> tự động clamp an toàn, chống HTTP 500")
    void search_WithInvalidPageAndSize_ClampsSafely() {
        Page<Content> emptyPage = new PageImpl<>(List.of());
        when(contentRepository.searchByKeyword(anyString(), anyString(), any(Pageable.class)))
                .thenReturn(emptyPage);

        // Client truyền page = -5, size = 500 (quá giới hạn)
        searchService.search("test", null, null, "newest", -5, 500);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(contentRepository).searchByKeyword(anyString(), anyString(), pageableCaptor.capture());

        Pageable captured = pageableCaptor.getValue();
        assertEquals(0, captured.getPageNumber(), "Page âm phải được clamp về 0");
        assertEquals(50, captured.getPageSize(), "Size quá lớn phải được clamp về tối đa 50 chống abuse");
    }

    @Test
    @DisplayName("ContentType không nằm trong whitelist ('BLOG', 'VIDEO') -> bỏ qua lọc type an toàn")
    void search_WithInvalidContentType_IgnoresTypeFilter() {
        Page<Content> emptyPage = new PageImpl<>(List.of());
        when(contentRepository.searchByKeyword(anyString(), anyString(), any(Pageable.class)))
                .thenReturn(emptyPage);

        searchService.search("tofu", null, "UNKNOWN_TYPE", "newest", 0, 10);

        // Gọi searchByKeyword thay vì searchByKeywordAndType
        verify(contentRepository).searchByKeyword(eq("%tofu%"), eq("published"), any(Pageable.class));
        verify(contentRepository, never()).searchByKeywordAndType(anyString(), anyString(), anyString(), any(Pageable.class));
    }

    @Test
    @DisplayName("Từ khóa rỗng nhưng có categoryId và contentType -> gọi findPublishedByTypeAndCategory")
    void search_EmptyKeywordWithCategoryAndType_CallsFindPublishedByTypeAndCategory() {
        Page<Content> emptyPage = new PageImpl<>(List.of());
        when(contentRepository.findPublishedByTypeAndCategory(eq("BLOG"), eq(3), eq("published"), any(Pageable.class)))
                .thenReturn(emptyPage);

        searchService.search("   ", 3, "BLOG", "newest", 0, 10);

        verify(contentRepository).findPublishedByTypeAndCategory(eq("BLOG"), eq(3), eq("published"), any(Pageable.class));
    }
}
