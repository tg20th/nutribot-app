package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.ContentCreateRequest;
import com.fpt.swp391.nutribot.dto.request.ContentUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.AuthorContentResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Category;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.ForbiddenException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.CategoryRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử AuthorContentService (Task NB-19: Author Blog CRUD, State Machine & Ownership Guards)")
class AuthorContentServiceTest {

    @Mock
    private ContentRepository contentRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private CloudinaryMediaService cloudinaryMediaService;

    @InjectMocks
    private AuthorContentService authorContentService;

    private User authorUser;
    private User otherUser;
    private Category validCategory;
    private Content sampleContent;

    @BeforeEach
    void setUp() {
        authorUser = User.builder()
                .userId(1)
                .username("truong_author")
                .status(AccountStatus.ACTIVE)
                .build();

        otherUser = User.builder()
                .userId(2)
                .username("hacker_user")
                .status(AccountStatus.ACTIVE)
                .build();

        validCategory = Category.builder()
                .categoryId(10)
                .categoryName("Món Chay Dinh Dưỡng")
                .slug("mon-chay-dinh-duong")
                .categoryType("RECIPE")
                .active(true)
                .build();

        sampleContent = Content.builder()
                .contentId(100)
                .user(authorUser)
                .contentType("BLOG")
                .categoryId(10)
                .title("7 Ngày Ăn Chay Thanh Lọc")
                .slug("7-ngay-an-chay-thanh-loc-12345")
                .body("Nội dung bài viết...")
                .thumbnailUrl("https://res.cloudinary.com/test-cloud/image/upload/nutribot/thumbnails/thumb_1_abc.jpg")
                .status("draft")
                .viewCount(0)
                .build();
    }

    // ==================== 1. OWNERSHIP & IDOR PROTECTION (BL-005) ====================

    @Test
    @DisplayName("1. Tạo bài viết gán tác giả từ principal và luôn khởi tạo trạng thái DRAFT")
    void createContent_success_setsDraftAndUserFromPrincipal() {
        ContentCreateRequest request = ContentCreateRequest.builder()
                .title("Hướng Dẫn Ăn Sạch")
                .body("Chi tiết chế độ ăn sạch...")
                .categoryId(10)
                .thumbnailUrl("https://res.cloudinary.com/test-cloud/thumb.jpg")
                .build();

        when(userRepository.findByUsername("truong_author")).thenReturn(Optional.of(authorUser));
        when(categoryRepository.findById(10)).thenReturn(Optional.of(validCategory));
        when(contentRepository.existsBySlug(anyString())).thenReturn(false);
        when(contentRepository.save(any(Content.class))).thenAnswer(invocation -> {
            Content c = invocation.getArgument(0);
            c.setContentId(101);
            return c;
        });

        AuthorContentResponse response = authorContentService.createContent("truong_author", "BLOG", request);

        assertNotNull(response);
        assertEquals("draft", response.getStatus());
        assertEquals("Hướng Dẫn Ăn Sạch", response.getTitle());

        ArgumentCaptor<Content> captor = ArgumentCaptor.forClass(Content.class);
        verify(contentRepository).save(captor.capture());
        Content saved = captor.getValue();
        assertEquals(authorUser.getUserId(), saved.getUser().getUserId());
        assertEquals("draft", saved.getStatus());
        assertEquals(0, saved.getViewCount());
    }

    @Test
    @DisplayName("2. Tác giả chính chủ cập nhật bài viết thành công")
    void updateContent_ownerSuccess() {
        ContentUpdateRequest request = ContentUpdateRequest.builder()
                .title("Tiêu Đề Mới Đã Sửa")
                .body("Nội dung mới...")
                .build();

        when(userRepository.findByUsername("truong_author")).thenReturn(Optional.of(authorUser));
        when(contentRepository.findById(100)).thenReturn(Optional.of(sampleContent));
        when(contentRepository.existsBySlug(anyString())).thenReturn(false);
        when(contentRepository.save(any(Content.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthorContentResponse response = authorContentService.updateContent("truong_author", 100, request);

        assertNotNull(response);
        assertEquals("Tiêu Đề Mới Đã Sửa", response.getTitle());
        assertEquals("Nội dung mới...", response.getBody());
    }

    @Test
    @DisplayName("3. Người dùng khác sửa bài của tác giả bị chặn HTTP 403 Forbidden")
    void updateContent_nonOwner_throwsForbidden() {
        ContentUpdateRequest request = ContentUpdateRequest.builder()
                .title("Tiêu Đề Bị Sửa Trộm")
                .build();

        when(userRepository.findByUsername("hacker_user")).thenReturn(Optional.of(otherUser));
        when(contentRepository.findById(100)).thenReturn(Optional.of(sampleContent));

        assertThrows(ForbiddenException.class, () ->
                authorContentService.updateContent("hacker_user", 100, request));
    }

    @Test
    @DisplayName("4. Người dùng khác xóa bài của tác giả bị chặn HTTP 403 Forbidden")
    void deleteContent_nonOwner_throwsForbidden() {
        when(userRepository.findByUsername("hacker_user")).thenReturn(Optional.of(otherUser));
        when(contentRepository.findById(100)).thenReturn(Optional.of(sampleContent));

        assertThrows(ForbiddenException.class, () ->
                authorContentService.deleteContent("hacker_user", 100));
        verify(contentRepository, never()).delete(any());
    }

    @Test
    @DisplayName("5. Người dùng khác xem bài nháp của tác giả bị chặn HTTP 403 Forbidden")
    void getContentById_nonOwner_throwsForbidden() {
        when(userRepository.findByUsername("hacker_user")).thenReturn(Optional.of(otherUser));
        when(contentRepository.findById(100)).thenReturn(Optional.of(sampleContent));

        assertThrows(ForbiddenException.class, () ->
                authorContentService.getContentById("hacker_user", 100));
    }

    @Test
    @DisplayName("6. Tra cứu bài viết theo ID không tồn tại ném HTTP 404 Not Found")
    void getContentById_notFound_throwsNotFound() {
        when(userRepository.findByUsername("truong_author")).thenReturn(Optional.of(authorUser));
        when(contentRepository.findById(999)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () ->
                authorContentService.getContentById("truong_author", 999));
    }

    // ==================== 2. STATE MACHINE INTEGRITY (BL-006) ====================

    @Test
    @DisplayName("7. Tác giả sửa bài viết đang PUBLISHED hoặc REJECTED tự động hạ về DRAFT")
    void updateContent_publishedOrRejected_resetsToDraft() {
        sampleContent.setStatus("published");

        ContentUpdateRequest request = ContentUpdateRequest.builder()
                .body("Nội dung vừa sửa đổi sau khi đã xuất bản...")
                .build();

        when(userRepository.findByUsername("truong_author")).thenReturn(Optional.of(authorUser));
        when(contentRepository.findById(100)).thenReturn(Optional.of(sampleContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthorContentResponse response = authorContentService.updateContent("truong_author", 100, request);

        assertEquals("draft", response.getStatus());
        assertEquals("draft", sampleContent.getStatus());
    }

    @Test
    @DisplayName("8. Tác giả cố tình gửi status PUBLISHED hoặc REJECTED bị chặn HTTP 400 Bad Request")
    void updateContent_invalidStatusTransition_throwsBadRequest() {
        ContentUpdateRequest requestPublished = ContentUpdateRequest.builder()
                .status("published")
                .build();

        when(userRepository.findByUsername("truong_author")).thenReturn(Optional.of(authorUser));
        when(contentRepository.findById(100)).thenReturn(Optional.of(sampleContent));

        assertThrows(BadRequestException.class, () ->
                authorContentService.updateContent("truong_author", 100, requestPublished));

        ContentUpdateRequest requestRejected = ContentUpdateRequest.builder()
                .status("rejected")
                .build();
        assertThrows(BadRequestException.class, () ->
                authorContentService.updateContent("truong_author", 100, requestRejected));
    }

    @Test
    @DisplayName("9. Nộp bài viết chuyển trạng thái sang UNDER_REVIEW")
    void submitContent_transitionsToUnderReview() {
        when(userRepository.findByUsername("truong_author")).thenReturn(Optional.of(authorUser));
        when(contentRepository.findById(100)).thenReturn(Optional.of(sampleContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthorContentResponse response = authorContentService.submitContent("truong_author", 100);

        assertEquals("under_review", response.getStatus());
        assertEquals("under_review", sampleContent.getStatus());
    }

    @Test
    @DisplayName("10. Rút bài viết về bản nháp chuyển trạng thái sang DRAFT")
    void recallContent_transitionsToDraft() {
        sampleContent.setStatus("under_review");

        when(userRepository.findByUsername("truong_author")).thenReturn(Optional.of(authorUser));
        when(contentRepository.findById(100)).thenReturn(Optional.of(sampleContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthorContentResponse response = authorContentService.recallContent("truong_author", 100);

        assertEquals("draft", response.getStatus());
        assertEquals("draft", sampleContent.getStatus());
    }

    // ==================== 3. CATEGORY & MEDIA INTEGRITY (BL-013, BL-020) ====================

    @Test
    @DisplayName("11. Chọn danh mục không tồn tại, inactive hoặc sai type ném HTTP 400")
    void createContent_invalidCategoryTypeOrInactive_throwsBadRequest() {
        ContentCreateRequest request = ContentCreateRequest.builder()
                .title("Bài Viết")
                .categoryId(99)
                .build();

        when(userRepository.findByUsername("truong_author")).thenReturn(Optional.of(authorUser));
        when(categoryRepository.findById(99)).thenReturn(Optional.empty());

        assertThrows(BadRequestException.class, () ->
                authorContentService.createContent("truong_author", "BLOG", request));

        // Case: Inactive category
        Category inactiveCategory = Category.builder()
                .categoryId(11)
                .categoryType("RECIPE")
                .active(false)
                .build();
        when(categoryRepository.findById(11)).thenReturn(Optional.of(inactiveCategory));
        request.setCategoryId(11);
        assertThrows(BadRequestException.class, () ->
                authorContentService.createContent("truong_author", "BLOG", request));

        // Case: Wrong category type (INGREDIENT instead of RECIPE)
        Category ingredientCategory = Category.builder()
                .categoryId(12)
                .categoryType("INGREDIENT")
                .active(true)
                .build();
        when(categoryRepository.findById(12)).thenReturn(Optional.of(ingredientCategory));
        request.setCategoryId(12);
        assertThrows(BadRequestException.class, () ->
                authorContentService.createContent("truong_author", "BLOG", request));
    }

    @Test
    @DisplayName("12. Xóa bài viết dọn dẹp ảnh thumbnail trên Cloudinary")
    void deleteContent_cleansUpCloudinaryThumbnail() {
        when(userRepository.findByUsername("truong_author")).thenReturn(Optional.of(authorUser));
        when(contentRepository.findById(100)).thenReturn(Optional.of(sampleContent));

        authorContentService.deleteContent("truong_author", 100);

        verify(contentRepository).delete(sampleContent);
        verify(cloudinaryMediaService).deleteThumbnailByUrl("https://res.cloudinary.com/test-cloud/image/upload/nutribot/thumbnails/thumb_1_abc.jpg");
    }

    @Test
    @DisplayName("13. Sinh slug tiếng Việt khử dấu chuẩn xác và duy nhất")
    void generateSlug_handlesVietnameseDiacritics() {
        ContentCreateRequest request = ContentCreateRequest.builder()
                .title("Cách Nấu Canh Rong Biển Đậu Hũ Thanh Đạm")
                .body("Nội dung công thức đầy đủ")
                .categoryId(10)
                .thumbnailUrl("https://res.cloudinary.com/test-cloud/image/upload/nutribot/thumbnails/thumb.jpg")
                .build();

        when(userRepository.findByUsername("truong_author")).thenReturn(Optional.of(authorUser));
        when(categoryRepository.findById(10)).thenReturn(Optional.of(validCategory));
        when(contentRepository.existsBySlug(anyString())).thenReturn(false);
        when(contentRepository.save(any(Content.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthorContentResponse response = authorContentService.createContent("truong_author", "BLOG", request);

        assertNotNull(response.getSlug());
        assertTrue(response.getSlug().startsWith("cach-nau-canh-rong-bien-dau-hu-thanh-dam-"));
        assertFalse(response.getSlug().contains("ă") || response.getSlug().contains("đ") || response.getSlug().contains("ủ"));
    }
}
