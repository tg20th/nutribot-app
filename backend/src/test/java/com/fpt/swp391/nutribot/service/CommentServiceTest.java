package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.CommentCreateRequest;
import com.fpt.swp391.nutribot.dto.response.CommentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Comment;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
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
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("Kiểm thử CommentService - Visibility Guard & Chặn tương tác trên nội dung chưa công khai (BL-011)")
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
    @DisplayName("Lấy bình luận của Video/Blog bản nháp hoặc không tồn tại -> Bắt buộc ném NotFoundException (HTTP 404)")
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
    @DisplayName("Lấy bình luận của nội dung khi tác giả bị khóa -> Bắt buộc ném NotFoundException (HTTP 404)")
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
    @DisplayName("Lấy bình luận của Video đã xuất bản của tác giả ACTIVE -> Thành công trả về danh sách")
    void getCommentsByContentId_WhenPublishedAndAuthorActive_ReturnsPagedComments() {
        User author = createSampleUser(1, "author1", AccountStatus.ACTIVE);
        Content video = createSampleContent(201, "VIDEO", "published", author);

        when(contentRepository.findPublishedById(201, "published")).thenReturn(Optional.of(video));
        when(commentRepository.findByContentIdAndParentIdIsNullAndStatus(eq(201), eq("active"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        PagedResponse<CommentResponse> response = commentService.getCommentsByContentId(201, 0, 10);

        assertNotNull(response);
        assertEquals(0, response.getContent().size());
        verify(commentRepository).findByContentIdAndParentIdIsNullAndStatus(eq(201), eq("active"), any(Pageable.class));
    }

    @Test
    @DisplayName("Gửi bình luận vào Video bản nháp hoặc chưa xuất bản -> Bị chặn với NotFoundException")
    void createComment_WhenContentDraftOrHidden_ThrowsNotFoundException() {
        User commenter = createSampleUser(2, "commenter", AccountStatus.ACTIVE);
        when(userRepository.findByUsername("commenter")).thenReturn(Optional.of(commenter));
        when(contentRepository.findPublishedById(555, "published")).thenReturn(Optional.empty());

        CommentCreateRequest request = new CommentCreateRequest();
        request.setBody("Bình luận thử nghiệm trên bản nháp");

        NotFoundException ex = assertThrows(
                NotFoundException.class,
                () -> commentService.createComment("commenter", 555, request)
        );

        assertTrue(ex.getMessage().contains("Nội dung không tồn tại"));
        verify(commentRepository, never()).save(any(Comment.class));
    }

    @Test
    @DisplayName("Gửi bình luận vào Video đã xuất bản -> Thành công lưu bình luận")
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
                .status("active")
                .createdAt(LocalDateTime.now())
                .build();
        when(commentRepository.save(any(Comment.class))).thenReturn(savedComment);
        when(userRepository.findById(commenter.getUserId())).thenReturn(Optional.of(commenter));

        CommentCreateRequest request = new CommentCreateRequest();
        request.setBody("Món này trông ngon quá!");

        CommentResponse response = commentService.createComment("commenter", 201, request);

        assertNotNull(response);
        assertEquals(10, response.getCommentId());
        assertEquals("Món này trông ngon quá!", response.getBody());
        verify(commentRepository).save(any(Comment.class));
    }
}
