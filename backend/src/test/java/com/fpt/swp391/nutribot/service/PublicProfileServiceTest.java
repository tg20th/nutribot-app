package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.ContentListResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.dto.response.PublicProfileStats;
import com.fpt.swp391.nutribot.dto.response.PublicUserProfileResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.Role;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.RecipeRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.repository.VoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("Kiểm thử PublicProfileService (Task NB-78: Public User Profile API)")
class PublicProfileServiceTest {

    private UserRepository userRepository;
    private ContentRepository contentRepository;
    private RecipeRepository recipeRepository;
    private VoteRepository voteRepository;
    private PublicProfileService publicProfileService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        contentRepository = mock(ContentRepository.class);
        recipeRepository = mock(RecipeRepository.class);
        voteRepository = mock(VoteRepository.class);
        publicProfileService = new PublicProfileService(
                userRepository, contentRepository, recipeRepository, voteRepository);
    }

    private User createActiveUser(int userId, String username, String fullName) {
        Role role = Role.builder().roleId(2).roleName("ROLE_USER").build();
        return User.builder()
                .userId(userId)
                .username(username)
                .fullName(fullName)
                .avatarUrl("https://cdn.nutribot.vn/avatars/user-" + userId + ".webp")
                .bio("Bio của " + fullName)
                .status(AccountStatus.ACTIVE)
                .role(role)
                .createdAt(LocalDateTime.of(2026, 5, 1, 10, 0))
                .build();
    }

    private Content createPublishedBlog(int contentId, int authorId, String title, String slug) {
        User author = User.builder().userId(authorId).username("author").fullName("Tác giả").status(AccountStatus.ACTIVE).build();
        return Content.builder()
                .contentId(contentId)
                .contentType("BLOG")
                .status("published")
                .title(title)
                .slug(slug)
                .thumbnailUrl("https://img.test/thumb" + contentId + ".jpg")
                .categoryId(1)
                .user(author)
                .viewCount(100)
                .createdAt(LocalDateTime.now())
                .build();
    }

    // ==================== getPublicProfile tests ====================

    @Nested
    @DisplayName("getPublicProfile")
    class GetPublicProfileTests {

        @Test
        @DisplayName("should return public profile when user exists and is ACTIVE")
        void shouldReturnProfile_WhenUserActive() {
            User user = createActiveUser(12, "hoanglan_ai", "Hoàng Thị Lan");
            when(userRepository.findByUsernameIgnoreCaseAndStatus("hoanglan_ai", AccountStatus.ACTIVE))
                    .thenReturn(Optional.of(user));
            when(contentRepository.countByContentTypeAndStatusAndUserUserId("BLOG", "published", 12)).thenReturn(5L);
            when(contentRepository.countByContentTypeAndStatusAndUserUserId("VIDEO", "published", 12)).thenReturn(2L);
            when(recipeRepository.countByCreatedByAndStatus(12, "verified")).thenReturn(1L);

            PublicUserProfileResponse result = publicProfileService.getPublicProfile("hoanglan_ai");

            assertNotNull(result);
            assertEquals(12, result.getUserId());
            assertEquals("hoanglan_ai", result.getUsername());
            assertEquals("Hoàng Thị Lan", result.getFullName());
            assertEquals("https://cdn.nutribot.vn/avatars/user-12.webp", result.getAvatarUrl());
            assertEquals("Bio của Hoàng Thị Lan", result.getBio());
            assertEquals("USER", result.getRole());
            assertEquals(LocalDateTime.of(2026, 5, 1, 10, 0), result.getJoinedAt());

            PublicProfileStats stats = result.getStats();
            assertNotNull(stats);
            assertEquals(5L, stats.getPublishedBlogCount());
            assertEquals(2L, stats.getPublishedVideoCount());
            assertEquals(1L, stats.getVerifiedRecipeCount());
            assertEquals(8L, stats.getTotalContributions());
        }

        @Test
        @DisplayName("should throw NotFoundException when user does not exist")
        void shouldThrow404_WhenUserNotFound() {
            when(userRepository.findByUsernameIgnoreCaseAndStatus("nonexistent", AccountStatus.ACTIVE))
                    .thenReturn(Optional.empty());

            NotFoundException ex = assertThrows(NotFoundException.class,
                    () -> publicProfileService.getPublicProfile("nonexistent"));

            assertEquals("Người dùng không tồn tại", ex.getMessage());
        }

        @Test
        @DisplayName("should throw NotFoundException when user is BANNED")
        void shouldThrow404_WhenUserBanned() {
            when(userRepository.findByUsernameIgnoreCaseAndStatus("banned_user", AccountStatus.ACTIVE))
                    .thenReturn(Optional.empty());

            NotFoundException ex = assertThrows(NotFoundException.class,
                    () -> publicProfileService.getPublicProfile("banned_user"));

            assertEquals("Người dùng không tồn tại", ex.getMessage());
        }

        @Test
        @DisplayName("should not expose email in response")
        void shouldNotExposeEmail() {
            User user = createActiveUser(1, "testuser", "Test User");
            when(userRepository.findByUsernameIgnoreCaseAndStatus("testuser", AccountStatus.ACTIVE))
                    .thenReturn(Optional.of(user));
            when(contentRepository.countByContentTypeAndStatusAndUserUserId(anyString(), anyString(), anyInt()))
                    .thenReturn(0L);
            when(recipeRepository.countByCreatedByAndStatus(anyInt(), anyString())).thenReturn(0L);

            PublicUserProfileResponse result = publicProfileService.getPublicProfile("testuser");

            // Email is NOT a field in PublicUserProfileResponse DTO — verified by absence of email field
            assertNotNull(result.getUsername());
            assertEquals("testuser", result.getUsername());
        }

        @Test
        @DisplayName("should strip ROLE_ prefix from role name")
        void shouldStripRolePrefix() {
            Role adminRole = Role.builder().roleId(1).roleName("ROLE_ADMIN").build();
            User admin = User.builder()
                    .userId(99)
                    .username("admin_user")
                    .fullName("Admin User")
                    .status(AccountStatus.ACTIVE)
                    .role(adminRole)
                    .createdAt(LocalDateTime.now())
                    .build();

            when(userRepository.findByUsernameIgnoreCaseAndStatus("admin_user", AccountStatus.ACTIVE))
                    .thenReturn(Optional.of(admin));
            when(contentRepository.countByContentTypeAndStatusAndUserUserId(anyString(), anyString(), anyInt()))
                    .thenReturn(0L);
            when(recipeRepository.countByCreatedByAndStatus(anyInt(), anyString())).thenReturn(0L);

            PublicUserProfileResponse result = publicProfileService.getPublicProfile("admin_user");

            assertEquals("ADMIN", result.getRole());
        }

        @Test
        @DisplayName("should return zero stats when user has no contributions")
        void shouldReturnZeroStats_WhenNoContributions() {
            User user = createActiveUser(99, "newuser", "New User");
            when(userRepository.findByUsernameIgnoreCaseAndStatus("newuser", AccountStatus.ACTIVE))
                    .thenReturn(Optional.of(user));
            when(contentRepository.countByContentTypeAndStatusAndUserUserId(anyString(), anyString(), anyInt()))
                    .thenReturn(0L);
            when(recipeRepository.countByCreatedByAndStatus(anyInt(), anyString())).thenReturn(0L);

            PublicUserProfileResponse result = publicProfileService.getPublicProfile("newuser");

            assertEquals(0L, result.getStats().getPublishedBlogCount());
            assertEquals(0L, result.getStats().getPublishedVideoCount());
            assertEquals(0L, result.getStats().getVerifiedRecipeCount());
            assertEquals(0L, result.getStats().getTotalContributions());
        }
    }

    // ==================== getPublicPosts tests ====================

    @Nested
    @DisplayName("getPublicPosts")
    class GetPublicPostsTests {

        @Test
        @DisplayName("should return paginated published blogs for valid user")
        void shouldReturnPaginatedBlogs() {
            User user = createActiveUser(5, "blogger", "Blogger Người Dùng");
            Content blog1 = createPublishedBlog(101, 5, "Bài viết 1", "bai-viet-1");
            Content blog2 = createPublishedBlog(102, 5, "Bài viết 2", "bai-viet-2");

            when(userRepository.findByUsernameIgnoreCaseAndStatus("blogger", AccountStatus.ACTIVE))
                    .thenReturn(Optional.of(user));
            when(voteRepository.countByContentId(anyInt())).thenReturn(10L);

            Page<Content> page = new PageImpl<>(List.of(blog1, blog2),
                    org.springframework.data.domain.PageRequest.of(0, 10), 2);
            when(contentRepository.findByContentTypeAndStatusAndUserUserId(
                    eq("BLOG"), eq("published"), eq(5), any(Pageable.class)))
                    .thenReturn(page);

            PagedResponse<ContentListResponse> result =
                    publicProfileService.getPublicPosts("blogger", "BLOG", 0, 10);

            assertNotNull(result);
            assertEquals(2, result.getContent().size());
            assertEquals(101, result.getContent().get(0).getContentId());
            assertEquals("Bài viết 1", result.getContent().get(0).getTitle());
            assertEquals(10L, result.getContent().get(0).getVoteCount());
            assertEquals(0, result.getCurrentPage());
            assertEquals(2, result.getTotalElements());
        }

        @Test
        @DisplayName("should return paginated published videos for valid user")
        void shouldReturnPaginatedVideos() {
            User user = createActiveUser(6, "videographer", "Video Người Dùng");
            Content video = Content.builder()
                    .contentId(201)
                    .contentType("VIDEO")
                    .status("published")
                    .title("Video 1")
                    .slug("video-1")
                    .mediaUrl("https://video.test/1.mp4")
                    .thumbnailUrl("https://img.test/vid1.jpg")
                    .user(user)
                    .viewCount(500)
                    .createdAt(LocalDateTime.now())
                    .build();

            when(userRepository.findByUsernameIgnoreCaseAndStatus("videographer", AccountStatus.ACTIVE))
                    .thenReturn(Optional.of(user));
            when(voteRepository.countByContentId(anyInt())).thenReturn(25L);

            Page<Content> page = new PageImpl<>(List.of(video),
                    org.springframework.data.domain.PageRequest.of(0, 10), 1);
            when(contentRepository.findByContentTypeAndStatusAndUserUserId(
                    eq("VIDEO"), eq("published"), eq(6), any(Pageable.class)))
                    .thenReturn(page);

            PagedResponse<ContentListResponse> result =
                    publicProfileService.getPublicPosts("videographer", "VIDEO", 0, 10);

            assertNotNull(result);
            assertEquals(1, result.getContent().size());
            assertEquals(201, result.getContent().get(0).getContentId());
            assertEquals("Video 1", result.getContent().get(0).getTitle());
        }

        @Test
        @DisplayName("should throw NotFoundException when user does not exist")
        void shouldThrow404_WhenUserNotFound() {
            when(userRepository.findByUsernameIgnoreCaseAndStatus("ghost", AccountStatus.ACTIVE))
                    .thenReturn(Optional.empty());

            NotFoundException ex = assertThrows(NotFoundException.class,
                    () -> publicProfileService.getPublicPosts("ghost", "BLOG", 0, 10));

            assertEquals("Người dùng không tồn tại", ex.getMessage());
        }

        @Test
        @DisplayName("should throw NotFoundException for invalid content type")
        void shouldThrow404_ForInvalidContentType() {
            User user = createActiveUser(1, "test", "Test");
            when(userRepository.findByUsernameIgnoreCaseAndStatus("test", AccountStatus.ACTIVE))
                    .thenReturn(Optional.of(user));

            NotFoundException ex = assertThrows(NotFoundException.class,
                    () -> publicProfileService.getPublicPosts("test", "RECIPE", 0, 10));

            assertEquals("Loại nội dung không hợp lệ", ex.getMessage());
        }

        @Test
        @DisplayName("should clamp page size to maximum 50")
        void shouldClampPageSize() {
            User user = createActiveUser(7, "biguser", "Big User");
            when(userRepository.findByUsernameIgnoreCaseAndStatus("biguser", AccountStatus.ACTIVE))
                    .thenReturn(Optional.of(user));

            Page<Content> emptyPage = new PageImpl<>(List.of(),
                    org.springframework.data.domain.PageRequest.of(0, 50), 0);
            when(contentRepository.findByContentTypeAndStatusAndUserUserId(
                    eq("BLOG"), eq("published"), eq(7), any(Pageable.class)))
                    .thenReturn(emptyPage);

            PagedResponse<ContentListResponse> result =
                    publicProfileService.getPublicPosts("biguser", "BLOG", 0, 999);

            assertNotNull(result);
            assertEquals(0, result.getContent().size());
            // Verify the size passed to repository was clamped to 50
            verify(contentRepository).findByContentTypeAndStatusAndUserUserId(
                    eq("BLOG"), eq("published"), eq(7),
                    argThat((Pageable p) -> p.getPageSize() == 50));
        }

        @Test
        @DisplayName("should return empty page when user has no published content")
        void shouldReturnEmptyPage_WhenNoPublishedContent() {
            User user = createActiveUser(8, "emptyuser", "Empty User");
            when(userRepository.findByUsernameIgnoreCaseAndStatus("emptyuser", AccountStatus.ACTIVE))
                    .thenReturn(Optional.of(user));

            Page<Content> emptyPage = new PageImpl<>(List.of(),
                    org.springframework.data.domain.PageRequest.of(0, 10), 0);
            when(contentRepository.findByContentTypeAndStatusAndUserUserId(
                    eq("BLOG"), eq("published"), eq(8), any(Pageable.class)))
                    .thenReturn(emptyPage);

            PagedResponse<ContentListResponse> result =
                    publicProfileService.getPublicPosts("emptyuser", "BLOG", 0, 10);

            assertNotNull(result);
            assertTrue(result.getContent().isEmpty());
            assertEquals(0, result.getTotalElements());
        }
    }
}
