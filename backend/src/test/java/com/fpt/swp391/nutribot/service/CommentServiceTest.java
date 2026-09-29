package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.CommentCreateRequest;
import com.fpt.swp391.nutribot.dto.request.CommentUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.CommentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Comment;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.ForbiddenException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.CommentRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("Kiểm thử CommentService - Quản lý Trạng thái, Quyền sở hữu và Chống lỗi Ràng buộc (BL-002, BL-005, BL-011)")
class CommentServiceTest {

    private CommentRepository commentRepository;
    private ContentRepository contentRepository;
    private UserRepository userRepository;
    private CommentService commentService;

    @BeforeEach
    void setUp() {
        commentRepository = mock(CommentRepository.class);
        contentRepository = mock(ContentRepository.class);
        userRepository = mock(UserRepository.class);
        commentService = new CommentService(commentRepository, contentRepository, userRepository);
    }

    private User createSampleUser(int id, String username, AccountStatus status) {
        return User.builder()
                .userId(id)
                .username(username)
                .fullName("User " + username)
                .status(status)
                .build();
    }

    private Content createSampleContent(int id, String contentType, String status, User author) {
        return Content.builder()
                .contentId(id)
                .contentType(contentType)
                .status(status)
                .title("Sample " + contentType)
                .slug("sample-" + contentType.toLowerCase() + "-" + id)
                .user(author)
                .viewCount(0)
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("Lấy bình luận của Video/Blog bản nháp hoặc không tồn tại -> Ném NotFoundException (HTTP 404)")
    void getCommentsByContentId_WhenDraftOrNotFound_ThrowsNotFoundException() {
        when(contentRepository.findPublishedById(999, "published")).thenReturn(Optional.empty());

        NotFoundException ex = assertThrows(
                NotFoundException.class,
                () -> commentService.getCommentsByContentId(999, 0, 10)
        );

        assertTrue(ex.getMessage().contains("Nội dung không tồn tại"));
        verify(commentRepository, never()).findByContentIdAndParentIdIsNullAndStatus(anyInt(), anyString(), any(Pageable.class));
    }

    @Test
    @DisplayName("Lấy bình luận của nội dung khi tác giả bị khóa -> Ném NotFoundException (HTTP 404)")
    void getCommentsByContentId_WhenAuthorInactive_ThrowsNotFoundException() {
        when(contentRepository.findPublishedById(888, "published")).thenReturn(Optional.empty());

        NotFoundException ex = assertThrows(
                NotFoundException.class,
                () -> commentService.getCommentsByContentId(888, 0, 10)
        );

        assertTrue(ex.getMessage().contains("Nội dung không tồn tại"));
        verify(commentRepository, never()).findByContentIdAndParentIdIsNullAndStatus(anyInt(), anyString(), any(Pageable.class));
    }

    @Test
    @DisplayName("Lấy bình luận của Video đã xuất bản -> Thành công trả về danh sách có status=published")
    void getCommentsByContentId_WhenPublishedAndAuthorActive_ReturnsPagedComments() {
        User author = createSampleUser(1, "author1", AccountStatus.ACTIVE);
        Content video = createSampleContent(201, "VIDEO", "published", author);

        when(contentRepository.findPublishedById(201, "published")).thenReturn(Optional.of(video));
        when(commentRepository.findByContentIdAndParentIdIsNullAndStatus(eq(201), eq("published"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        PagedResponse<CommentResponse> response = commentService.getCommentsByContentId(201, 0, 10);

        assertNotNull(response);
        assertEquals(0, response.getContent().size());
        verify(commentRepository).findByContentIdAndParentIdIsNullAndStatus(eq(201), eq("published"), any(Pageable.class));
    }

    @Test
    @DisplayName("Gửi bình luận vào Video bản nháp hoặc chưa xuất bản -> Bị chặn với NotFoundException")
    void createComment_WhenContentDraftOrHidden_ThrowsNotFoundException() {
        User commenter = createSampleUser(2, "commenter", AccountStatus.ACTIVE);
        when(userRepository.findByUsername("commenter")).thenReturn(Optional.of(commenter));
        when(contentRepository.findPublishedById(555, "published")).thenReturn(Optional.empty());

        CommentCreateRequest request = new CommentCreateRequest("Bình luận thử nghiệm trên bản nháp", null);

        NotFoundException ex = assertThrows(
                NotFoundException.class,
                () -> commentService.createComment("commenter", 555, request)
        );

        assertTrue(ex.getMessage().contains("Nội dung không tồn tại"));
        verify(commentRepository, never()).save(any(Comment.class));
    }

    @Test
    @DisplayName("Gửi bình luận vào Video đã xuất bản -> Thành công lưu với status=published (BL-002)")
    void createComment_WhenPublished_SuccessfullyCreatesComment() {
        User commenter = createSampleUser(2, "commenter", AccountStatus.ACTIVE);
        User author = createSampleUser(1, "author1", AccountStatus.ACTIVE);
        Content video = createSampleContent(201, "VIDEO", "published", author);

        when(userRepository.findByUsername("commenter")).thenReturn(Optional.of(commenter));
        when(contentRepository.findPublishedById(201, "published")).thenReturn(Optional.of(video));

        Comment savedComment = Comment.builder()
                .commentId(10)
                .contentId(201)
                .userId(commenter.getUserId())
                .body("Món này trông ngon quá!")
                .status("published")
                .createdAt(LocalDateTime.now())
                .build();
        when(commentRepository.save(any(Comment.class))).thenReturn(savedComment);
        when(userRepository.findById(commenter.getUserId())).thenReturn(Optional.of(commenter));

        CommentCreateRequest request = new CommentCreateRequest("  Món này trông ngon quá!  ", null);

        CommentResponse response = commentService.createComment("commenter", 201, request);

        assertNotNull(response);
        assertEquals(10, response.getCommentId());
        assertEquals("Món này trông ngon quá!", response.getBody());
        verify(commentRepository).save(argThat(c -> "published".equals(c.getStatus()) && c.getBody().equals("Món này trông ngon quá!")));
    }

    @Test
    @DisplayName("Tài khoản chưa kích hoạt hoặc bị khóa bình luận -> Ném ForbiddenException")
    void createComment_WhenUserNotActive_ThrowsForbiddenException() {
        User commenter = createSampleUser(2, "banned_user", AccountStatus.BANNED);
        when(userRepository.findByUsername("banned_user")).thenReturn(Optional.of(commenter));

        CommentCreateRequest request = new CommentCreateRequest("Bình luận từ acc bị ban", null);

        assertThrows(ForbiddenException.class, () -> commentService.createComment("banned_user", 201, request));
        verify(commentRepository, never()).save(any(Comment.class));
    }

    @Test
    @DisplayName("Nội dung bình luận rỗng hoặc chỉ khoảng trắng -> Ném BadRequestException")
    void createComment_WhenBodyBlank_ThrowsBadRequestException() {
        User commenter = createSampleUser(2, "commenter", AccountStatus.ACTIVE);
        User author = createSampleUser(1, "author1", AccountStatus.ACTIVE);
        Content video = createSampleContent(201, "VIDEO", "published", author);

        when(userRepository.findByUsername("commenter")).thenReturn(Optional.of(commenter));
        when(contentRepository.findPublishedById(201, "published")).thenReturn(Optional.of(video));

        assertThrows(BadRequestException.class, () -> commentService.createComment("commenter", 201, new CommentCreateRequest("", null)));
        assertThrows(BadRequestException.class, () -> commentService.createComment("commenter", 201, new CommentCreateRequest("   ", null)));
        assertThrows(BadRequestException.class, () -> commentService.createComment("commenter", 201, new CommentCreateRequest(null, null)));
    }

    @Test
    @DisplayName("Chỉnh sửa bình luận của chính mình -> Thành công cập nhật nội dung (BL-005)")
    void updateComment_WhenOwner_SuccessfullyUpdates() {
        User commenter = createSampleUser(2, "commenter", AccountStatus.ACTIVE);
        User author = createSampleUser(1, "author1", AccountStatus.ACTIVE);
        Content video = createSampleContent(201, "VIDEO", "published", author);

        Comment existingComment = Comment.builder()
                .commentId(10)
                .contentId(201)
                .userId(commenter.getUserId())
                .body("Nội dung cũ")
                .status("published")
                .createdAt(LocalDateTime.now())
                .build();

        when(userRepository.findByUsername("commenter")).thenReturn(Optional.of(commenter));
        when(commentRepository.findByIdForUpdate(10)).thenReturn(Optional.of(existingComment));
        when(contentRepository.findPublishedById(201, "published")).thenReturn(Optional.of(video));
        when(commentRepository.save(any(Comment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findById(commenter.getUserId())).thenReturn(Optional.of(commenter));

        CommentUpdateRequest request = new CommentUpdateRequest("Nội dung đã sửa");
        CommentResponse response = commentService.updateComment("commenter", 10, request);

        assertNotNull(response);
        assertEquals("Nội dung đã sửa", response.getBody());
        verify(commentRepository).save(argThat(c -> "Nội dung đã sửa".equals(c.getBody())));
    }

    @Test
    @DisplayName("Chỉnh sửa bình luận của người khác (Cross-user) -> Ném ForbiddenException (BL-005)")
    void updateComment_WhenCrossUser_ThrowsForbiddenException() {
        User userA = createSampleUser(2, "userA", AccountStatus.ACTIVE);

        Comment commentOfUserB = Comment.builder()
                .commentId(10)
                .contentId(201)
                .userId(99) // Thuộc user B
                .body("Comment của user B")
                .status("published")
                .build();

        when(userRepository.findByUsername("userA")).thenReturn(Optional.of(userA));
        when(commentRepository.findByIdForUpdate(10)).thenReturn(Optional.of(commentOfUserB));

        CommentUpdateRequest request = new CommentUpdateRequest("Sửa lén");

        assertThrows(ForbiddenException.class, () -> commentService.updateComment("userA", 10, request));
        verify(commentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Xóa bình luận của chính mình -> Soft-delete thành status=hidden (BL-002, BL-005)")
    void deleteComment_WhenOwner_SoftDeletesToHidden() {
        User commenter = createSampleUser(2, "commenter", AccountStatus.ACTIVE);

        Comment comment = Comment.builder()
                .commentId(10)
                .contentId(201)
                .userId(commenter.getUserId())
                .body("Muốn xóa bình luận này")
                .status("published")
                .build();

        when(userRepository.findByUsername("commenter")).thenReturn(Optional.of(commenter));
        when(commentRepository.findByIdForUpdate(10)).thenReturn(Optional.of(comment));

        commentService.deleteComment("commenter", 10);

        assertEquals("hidden", comment.getStatus());
        verify(commentRepository).save(argThat(c -> "hidden".equals(c.getStatus())));
    }

    @Test
    @DisplayName("Xóa bình luận của người khác (Cross-user) -> Ném ForbiddenException (BL-005)")
    void deleteComment_WhenCrossUser_ThrowsForbiddenException() {
        User userA = createSampleUser(2, "userA", AccountStatus.ACTIVE);

        Comment commentOfUserB = Comment.builder()
                .commentId(10)
                .contentId(201)
                .userId(99)
                .body("Comment của user B")
                .status("published")
                .build();

        when(userRepository.findByUsername("userA")).thenReturn(Optional.of(userA));
        when(commentRepository.findByIdForUpdate(10)).thenReturn(Optional.of(commentOfUserB));

        assertThrows(ForbiddenException.class, () -> commentService.deleteComment("userA", 10));
        verify(commentRepository, never()).save(any());
    }
}
