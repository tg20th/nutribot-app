package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.HomeSummaryResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Category;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.repository.CategoryRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DisplayName("Kiểm thử HomeService (Task NB-13: API Tổng hợp Trang chủ Welcome)")
class HomeServiceTest {

    private ContentRepository contentRepository;
    private CategoryRepository categoryRepository;
    private UserRepository userRepository;
    private HomeService homeService;

    @BeforeEach
    void setUp() {
        contentRepository = mock(ContentRepository.class);
        categoryRepository = mock(CategoryRepository.class);
        userRepository = mock(UserRepository.class);
        homeService = new HomeService(contentRepository, categoryRepository, userRepository);
    }

    @Test
    @DisplayName("Lấy dữ liệu trang chủ tổng hợp thành công và ánh xạ đúng DTO public")
    void getHomeSummary_Success() {
        User activeAuthor = User.builder()
                .userId(1)
                .username("lan_healthy")
                .fullName("Hoàng Thị Lan")
                .status(AccountStatus.ACTIVE)
                .build();

        Content blog = Content.builder()
                .contentId(101)
                .contentType("BLOG")
                .status("published")
                .title("5 Công thức Smoothie Thực vật Giàu Protein")
                .slug("5-cong-thuc-smoothie-thuc-vat")
                .thumbnailUrl("https://cdn.nutribot.vn/smoothie.webp")
                .categoryId(2)
                .user(activeAuthor)
                .viewCount(150)
                .createdAt(LocalDateTime.now())
                .build();

        Content video = Content.builder()
                .contentId(201)
                .contentType("VIDEO")
                .status("published")
                .title("Hướng Dẫn Nấu Canh Rong Biển Hạt Sen")
                .slug("huong-dan-nau-canh-rong-bien")
                .thumbnailUrl("https://cdn.nutribot.vn/soup.webp")
                .categoryId(3)
                .user(activeAuthor)
                .viewCount(280)
                .createdAt(LocalDateTime.now())
                .build();

        Category category = Category.builder()
                .categoryId(1)
                .categoryName("Thực đơn Thuần chay")
                .slug("thuc-don-thuan-chay")
                .iconUrl("https://cdn.nutribot.vn/vegan.svg")
                .build();

        when(contentRepository.findPublishedByTypeWithLimit(eq("BLOG"), eq("published"), eq(PageRequest.of(0, 6))))
                .thenReturn(List.of(blog));
        when(contentRepository.findPublishedByTypeWithLimit(eq("VIDEO"), eq("published"), eq(PageRequest.of(0, 6))))
                .thenReturn(List.of(video));
        when(categoryRepository.findRootCategories())
                .thenReturn(List.of(category));
        when(contentRepository.countPublishedByTypeAndActiveAuthor("BLOG", "published"))
                .thenReturn(15L);
        when(contentRepository.countPublishedByTypeAndActiveAuthor("VIDEO", "published"))
                .thenReturn(8L);
        when(userRepository.count())
                .thenReturn(120L);

        HomeSummaryResponse response = homeService.getHomeSummary();

        assertNotNull(response);
        assertEquals(1, response.getFeaturedBlogs().size());
        assertEquals("5 Công thức Smoothie Thực vật Giàu Protein", response.getFeaturedBlogs().get(0).getTitle());
        assertEquals("Hoàng Thị Lan", response.getFeaturedBlogs().get(0).getAuthorName());
        assertEquals(2, response.getFeaturedBlogs().get(0).getCategoryId());
        assertEquals(150, response.getFeaturedBlogs().get(0).getViewCount());

        assertEquals(1, response.getLatestVideos().size());
        assertEquals("Hướng Dẫn Nấu Canh Rong Biển Hạt Sen", response.getLatestVideos().get(0).getTitle());
        assertEquals("Hoàng Thị Lan", response.getLatestVideos().get(0).getAuthorName());
        assertEquals(280, response.getLatestVideos().get(0).getViewCount());

        assertEquals(1, response.getCategories().size());
        assertEquals("Thực đơn Thuần chay", response.getCategories().get(0).getCategoryName());

        assertNotNull(response.getStats());
        assertEquals(15L, response.getStats().getTotalBlogs());
        assertEquals(8L, response.getStats().getTotalVideos());
        assertEquals(120L, response.getStats().getTotalUsers());

        verify(contentRepository).findPublishedByTypeWithLimit(eq("BLOG"), eq("published"), eq(PageRequest.of(0, 6)));
        verify(contentRepository).findPublishedByTypeWithLimit(eq("VIDEO"), eq("published"), eq(PageRequest.of(0, 6)));
    }

    @Test
    @DisplayName("Xử lý an toàn khi cơ sở dữ liệu chưa có bài viết hoặc tác giả null")
    void getHomeSummary_WithEmptyData_HandlesGracefully() {
        when(contentRepository.findPublishedByTypeWithLimit(anyString(), anyString(), any()))
                .thenReturn(Collections.emptyList());
        when(categoryRepository.findRootCategories())
                .thenReturn(Collections.emptyList());
        when(contentRepository.countPublishedByTypeAndActiveAuthor(anyString(), anyString()))
                .thenReturn(0L);
        when(userRepository.count())
                .thenReturn(0L);

        HomeSummaryResponse response = homeService.getHomeSummary();

        assertNotNull(response);
        assertTrue(response.getFeaturedBlogs().isEmpty());
        assertTrue(response.getLatestVideos().isEmpty());
        assertTrue(response.getCategories().isEmpty());
        assertEquals(0L, response.getStats().getTotalBlogs());
        assertEquals(0L, response.getStats().getTotalVideos());
        assertEquals(0L, response.getStats().getTotalUsers());
    }
}
