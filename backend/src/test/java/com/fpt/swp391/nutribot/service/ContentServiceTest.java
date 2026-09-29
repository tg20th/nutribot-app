package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.ContentDetailResponse;
import com.fpt.swp391.nutribot.dto.response.ContentListResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.dto.response.VideoDetailResponse;
import com.fpt.swp391.nutribot.dto.response.VideoListResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("Kiểm thử ContentService (Task NB-17 & BL-011: Visibility Rule cho Public Blog & Video APIs)")
class ContentServiceTest {

    private ContentRepository contentRepository;
    private com.fpt.swp391.nutribot.repository.VoteRepository voteRepository;
    private ContentService contentService;

    @BeforeEach
    void setUp() {
        contentRepository = mock(ContentRepository.class);
        voteRepository = mock(com.fpt.swp391.nutribot.repository.VoteRepository.class);
        contentService = new ContentService(contentRepository, voteRepository);
    }

    private User createActiveAuthor(int userId, String name) {
        return User.builder()
                .userId(userId)
                .username("user_" + userId)
                .fullName(name)
                .avatarUrl("https://img.test/avatar_" + userId + ".jpg")
                .status(AccountStatus.ACTIVE)
                .build();
    }

    private Content createSampleBlog(int id, String title, String slug, int views) {
        return Content.builder()
                .contentId(id)
                .contentType("BLOG")
                .status("published")
                .title(title)
                .slug(slug)
                .body("Nội dung bài viết mẫu " + id)
                .thumbnailUrl("https://img.test/thumb" + id + ".jpg")
                .categoryId(2)
                .user(createActiveAuthor(1, "Nguyễn Văn Tác Giả"))
                .viewCount(views)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private Content createSampleVideo(int id, String title, String slug, int views) {
        return Content.builder()
                .contentId(id)
                .contentType("VIDEO")
                .status("published")
                .title(title)
                .slug(slug)
                .body("Mô tả video mẫu " + id)
                .mediaUrl("https://video.test/" + id + ".mp4")
                .thumbnailUrl("https://img.test/vid" + id + ".jpg")
                .durationSec(180)
                .categoryId(3)
                .user(createActiveAuthor(2, "Trần Video Master"))
                .viewCount(views)
                .createdAt(LocalDateTime.now())
                .build();
    }

    // ==================== BLOG DETAIL TESTS (BL-011) ====================

    @Test
    @DisplayName("Guest truy cập Blog ID bản nháp / không tồn tại -> Bắt buộc ném NotFoundException (HTTP 404), không rò rỉ nội dung")
    void getBlogById_WhenDraftOrNotFound_ThrowsNotFoundException() {
        when(contentRepository.findPublishedByIdAndType(999, "BLOG", "published"))
                .thenReturn(Optional.empty());

        NotFoundException exception = assertThrows(
                NotFoundException.class,
                () -> contentService.getBlogById(999)
        );

        assertEquals("Bài viết không tồn tại", exception.getMessage());
        verify(contentRepository, never()).incrementViewCount(anyInt());
    }

    @Test
    @DisplayName("Guest truy cập Blog Slug bản nháp / không tồn tại -> Bắt buộc ném NotFoundException (HTTP 404)")
    void getBlogBySlug_WhenDraftOrNotFound_ThrowsNotFoundException() {
        when(contentRepository.findPublishedBySlugAndType("draft-secret-slug", "BLOG", "published"))
                .thenReturn(Optional.empty());

        NotFoundException exception = assertThrows(
                NotFoundException.class,
                () -> contentService.getBlogBySlug("draft-secret-slug")
        );

        assertEquals("Bài viết không tồn tại", exception.getMessage());
        verify(contentRepository, never()).incrementViewCount(anyInt());
    }

    @Test
    @DisplayName("Truy cập Blog ID đã công khai của tác giả active -> Trả về DTO public allowlist và tăng viewCount")
    void getBlogById_WhenPublishedAndAuthorActive_ReturnsDetailAndIncrementsViewCount() {
        Content blog = createSampleBlog(101, "Ăn chay khoa học", "an-chay-khoa-hoc", 50);
        when(contentRepository.findPublishedByIdAndType(101, "BLOG", "published"))
                .thenReturn(Optional.of(blog));

        ContentDetailResponse response = contentService.getBlogById(101);

        assertNotNull(response);
        assertEquals(101, response.getContentId());
        assertEquals("Ăn chay khoa học", response.getTitle());
        assertEquals("Nguyễn Văn Tác Giả", response.getAuthorName());
        assertEquals(51, response.getViewCount()); // Tăng lên 1
        verify(contentRepository, times(1)).incrementViewCount(101);
    }

    @Test
    @DisplayName("Truy cập Blog Slug đã công khai của tác giả active -> Trả về DTO và tăng viewCount")
    void getBlogBySlug_WhenPublishedAndAuthorActive_ReturnsDetailAndIncrementsViewCount() {
        Content blog = createSampleBlog(102, "Dinh dưỡng thuần chay", "dinh-duong-thuan-chay", 10);
        when(contentRepository.findPublishedBySlugAndType("dinh-duong-thuan-chay", "BLOG", "published"))
                .thenReturn(Optional.of(blog));

        ContentDetailResponse response = contentService.getBlogBySlug("dinh-duong-thuan-chay");

        assertNotNull(response);
        assertEquals(102, response.getContentId());
        assertEquals("dinh-duong-thuan-chay", blog.getSlug());
        assertEquals(11, response.getViewCount());
        verify(contentRepository, times(1)).incrementViewCount(102);
    }

    // ==================== BLOG LIST TESTS ====================

    @Test
    @DisplayName("Lấy danh sách Blog không truyền categoryId -> Sử dụng query lọc tác giả active và sắp xếp deterministic tie-breaker")
    void getPublishedBlogs_WithoutCategory_UsesActiveAuthorAndDeterministicSort() {
        Content blog = createSampleBlog(1, "Blog 1", "blog-1", 5);
        Page<Content> mockPage = new PageImpl<>(List.of(blog));
        when(contentRepository.findPublishedByType(eq("BLOG"), eq("published"), any(Pageable.class)))
                .thenReturn(mockPage);

        PagedResponse<ContentListResponse> response = contentService.getPublishedBlogs(0, 10, null);

        assertNotNull(response);
        assertEquals(1, response.getContent().size());

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(contentRepository).findPublishedByType(eq("BLOG"), eq("published"), pageableCaptor.capture());

        Pageable pageable = pageableCaptor.getValue();
        assertEquals(0, pageable.getPageNumber());
        assertEquals(10, pageable.getPageSize());

        // Kiểm tra sắp xếp tie-breaker: createdAt DESC, contentId DESC
        Sort.Order order1 = pageable.getSort().getOrderFor("createdAt");
        Sort.Order order2 = pageable.getSort().getOrderFor("contentId");
        assertNotNull(order1);
        assertNotNull(order2);
        assertTrue(order1.isDescending());
        assertTrue(order2.isDescending());
    }

    @Test
    @DisplayName("Lấy danh sách Blog có categoryId -> Sử dụng findPublishedByTypeAndCategory")
    void getPublishedBlogs_WithCategory_UsesActiveAuthorAndCategory() {
        Content blog = createSampleBlog(2, "Blog 2", "blog-2", 20);
        Page<Content> mockPage = new PageImpl<>(List.of(blog));
        when(contentRepository.findPublishedByTypeAndCategory(eq("BLOG"), eq(5), eq("published"), any(Pageable.class)))
                .thenReturn(mockPage);

        PagedResponse<ContentListResponse> response = contentService.getPublishedBlogs(0, 15, 5);

        assertNotNull(response);
        assertEquals(1, response.getContent().size());
        verify(contentRepository).findPublishedByTypeAndCategory(eq("BLOG"), eq(5), eq("published"), any(Pageable.class));
    }

    // ==================== VIDEO TESTS ====================

    @Test
    @DisplayName("Guest truy cập Video ID bản nháp / không tồn tại -> Bắt buộc ném NotFoundException (HTTP 404)")
    void getVideoById_WhenDraftOrNotFound_ThrowsNotFoundException() {
        when(contentRepository.findPublishedByIdAndType(888, "VIDEO", "published"))
                .thenReturn(Optional.empty());

        NotFoundException exception = assertThrows(
                NotFoundException.class,
                () -> contentService.getVideoById(888)
        );

        assertEquals("Video không tồn tại", exception.getMessage());
        verify(contentRepository, never()).incrementViewCount(anyInt());
    }

    @Test
    @DisplayName("Guest truy cập Video Slug bản nháp / không tồn tại -> Bắt buộc ném NotFoundException (HTTP 404)")
    void getVideoBySlug_WhenDraftOrNotFound_ThrowsNotFoundException() {
        when(contentRepository.findPublishedBySlugAndType("draft-video", "VIDEO", "published"))
                .thenReturn(Optional.empty());

        NotFoundException exception = assertThrows(
                NotFoundException.class,
                () -> contentService.getVideoBySlug("draft-video")
        );

        assertEquals("Video không tồn tại", exception.getMessage());
        verify(contentRepository, never()).incrementViewCount(anyInt());
    }

    @Test
    @DisplayName("Truy cập Video đã công khai -> Trả về DTO và tăng viewCount")
    void getVideoById_WhenPublished_ReturnsDetailAndIncrementsViewCount() {
        Content video = createSampleVideo(201, "Hướng dẫn nấu cháo nấm", "nau-chao-nam", 30);
        when(contentRepository.findPublishedByIdAndType(201, "VIDEO", "published"))
                .thenReturn(Optional.of(video));

        VideoDetailResponse response = contentService.getVideoById(201);

        assertNotNull(response);
        assertEquals(201, response.getContentId());
        assertEquals("Hướng dẫn nấu cháo nấm", response.getTitle());
        assertEquals(31, response.getViewCount());
        verify(contentRepository, times(1)).incrementViewCount(201);
    }

    @Test
    @DisplayName("Lấy danh sách Video công khai có categoryId -> Sử dụng findPublishedByTypeAndCategory")
    void getPublishedVideos_WithCategory_UsesActiveAuthorAndCategory() {
        Content video = createSampleVideo(302, "Video 302", "video-302", 50);
        Page<Content> mockPage = new PageImpl<>(List.of(video));
        when(contentRepository.findPublishedByTypeAndCategory(eq("VIDEO"), eq(4), eq("published"), any(Pageable.class)))
                .thenReturn(mockPage);

        PagedResponse<VideoListResponse> response = contentService.getPublishedVideos(0, 10, 4);

        assertNotNull(response);
        assertEquals(1, response.getContent().size());
        verify(contentRepository).findPublishedByTypeAndCategory(eq("VIDEO"), eq(4), eq("published"), any(Pageable.class));
    }

    @Test
    @DisplayName("Lấy chi tiết Video kèm số vote thực tế từ VoteRepository")
    void getVideoById_IncludesVoteCountFromVoteRepository() {
        Content video = createSampleVideo(201, "Hướng dẫn nấu cháo nấm", "nau-chao-nam", 30);
        when(contentRepository.findPublishedByIdAndType(201, "VIDEO", "published"))
                .thenReturn(Optional.of(video));
        when(voteRepository.countByContentId(201)).thenReturn(15L);

        VideoDetailResponse response = contentService.getVideoById(201);

        assertNotNull(response);
        assertEquals(15, response.getVoteCount());
    }

    @Test
    @DisplayName("Tra cứu Video qua slugOrId -> Tự động nhận diện ID số nguyên hoặc slug")
    void getVideoByIdOrSlug_ResolvesBothIdAndSlug() {
        Content video = createSampleVideo(201, "Hướng dẫn nấu cháo nấm", "nau-chao-nam", 30);
        when(contentRepository.findPublishedByIdAndType(201, "VIDEO", "published"))
                .thenReturn(Optional.of(video));
        when(contentRepository.findPublishedBySlugAndType("nau-chao-nam", "VIDEO", "published"))
                .thenReturn(Optional.of(video));

        // Gọi qua số nguyên dạng chuỗi
        VideoDetailResponse res1 = contentService.getVideoByIdOrSlug("201");
        assertNotNull(res1);
        assertEquals(201, res1.getContentId());

        // Gọi qua slug
        VideoDetailResponse res2 = contentService.getVideoByIdOrSlug("nau-chao-nam");
        assertNotNull(res2);
        assertEquals("nau-chao-nam", video.getSlug());
    }

    @Test
    @DisplayName("Load bài viết/video công khai -> Trả về đầy đủ authorAvatar, avatarUrl, authorUsername và authorId của tác giả")
    void getBlogAndVideo_LoadsAuthorAvatarAndMetadata() {
        Content blog = createSampleBlog(10, "Món ngon mỗi ngày", "mon-ngon-moi-ngay", 50);
        when(contentRepository.findPublishedByIdAndType(10, "BLOG", "published"))
                .thenReturn(Optional.of(blog));

        ContentDetailResponse blogDetail = contentService.getBlogById(10);
        assertNotNull(blogDetail);
        assertEquals(1, blogDetail.getAuthorId());
        assertEquals("user_1", blogDetail.getAuthorUsername());
        assertEquals("Nguyễn Văn Tác Giả", blogDetail.getAuthorName());
        assertEquals("https://img.test/avatar_1.jpg", blogDetail.getAuthorAvatar());
        assertEquals("https://img.test/avatar_1.jpg", blogDetail.getAvatarUrl());

        Content video = createSampleVideo(20, "Video nấu ăn", "video-nau-an", 80);
        when(contentRepository.findPublishedByIdAndType(20, "VIDEO", "published"))
                .thenReturn(Optional.of(video));

        VideoDetailResponse videoDetail = contentService.getVideoById(20);
        assertNotNull(videoDetail);
        assertEquals(2, videoDetail.getAuthorId());
        assertEquals("user_2", videoDetail.getAuthorUsername());
        assertEquals("Trần Video Master", videoDetail.getAuthorName());
        assertEquals("https://img.test/avatar_2.jpg", videoDetail.getAuthorAvatar());
        assertEquals("https://img.test/avatar_2.jpg", videoDetail.getAvatarUrl());
    }
}
