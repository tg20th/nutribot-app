package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.AdminCommentStatusRequest;
import com.fpt.swp391.nutribot.dto.response.AdminCommentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.Comment;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.CommentRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử AdminCommentService - Lọc DB, Phân trang an toàn, Soft Delete & Kiểm duyệt (Task NB-40)")
class AdminCommentServiceTest {

    @Mock
    private CommentRepository commentRepository;

    @Mock
    private ContentRepository contentRepository;

    @InjectMocks
    private AdminCommentService adminCommentService;

    private User sampleUser;
    private Comment comment1;
    private Comment comment2;
    private Content sampleContent;

    @BeforeEach
    void setUp() {
        sampleUser = User.builder()
                .userId(10)
                .username("lan_foodie")
                .email("lan@example.com")
                .fullName("Nguyen Tuyet Lan")
                .build();

        sampleContent = Content.builder()
                .contentId(100)
                .title("Cách nấu canh rong biển chay")
                .contentType("BLOG")
                .build();

        comment1 = Comment.builder()
                .commentId(1)
                .contentId(100)
                .userId(10)
                .user(sampleUser)
                .body("Bài viết rất hay và bổ ích")
                .status("published")
                .createdAt(LocalDateTime.now().minusDays(1))
                .build();

        comment2 = Comment.builder()
                .commentId(2)
                .contentId(100)
                .userId(10)
                .user(sampleUser)
                .body("Spam quảng cáo độc hại")
                .status("hidden")
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("getAllComments -> Lọc theo keyword, status và batch fetch content tối ưu N+1")
    void getAllComments_success_returnsPagedResponseWithBatchContent() {
        PageImpl<Comment> commentPage = new PageImpl<>(List.of(comment1, comment2));
        when(commentRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(commentPage);
        when(contentRepository.findAllById(anySet())).thenReturn(List.of(sampleContent));

        PagedResponse<AdminCommentResponse> result = adminCommentService.getAllComments("quảng cáo", "hidden", 0, 10);

        assertThat(result).isNotNull();
        assertThat(result.getContent()).hasSize(2);
        assertThat(result.getContent().get(0).getContentTitle()).isEqualTo("Cách nấu canh rong biển chay");
        assertThat(result.getContent().get(0).getContentType()).isEqualTo("BLOG");
        assertThat(result.getContent().get(0).getUsername()).isEqualTo("lan_foodie");

        verify(commentRepository).findAll(any(Specification.class), any(Pageable.class));
        verify(contentRepository).findAllById(Set.of(100));
    }

    @Test
    @DisplayName("getAllComments -> Kẹp an toàn khi page âm hoặc size vượt ngưỡng MAX_PAGE_SIZE (50)")
    void getAllComments_boundsPaginationProperly() {
        PageImpl<Comment> emptyPage = new PageImpl<>(List.of());
        when(commentRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(emptyPage);

        PagedResponse<AdminCommentResponse> result = adminCommentService.getAllComments(null, null, -5, 500);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(commentRepository).findAll(any(Specification.class), pageableCaptor.capture());

        Pageable capturedPageable = pageableCaptor.getValue();
        assertThat(capturedPageable.getPageNumber()).isEqualTo(0);
        assertThat(capturedPageable.getPageSize()).isEqualTo(50);
    }

    @Test
    @DisplayName("deleteComment -> Thực hiện Soft-Delete chuyển status sang hidden bảo vệ khóa ngoại reply")
    void deleteComment_success_softDeletesToHidden() {
        when(commentRepository.findByIdForUpdate(1)).thenReturn(Optional.of(comment1));

        adminCommentService.deleteComment(1, "admin_master");

        assertThat(comment1.getStatus()).isEqualTo("hidden");
        assertThat(comment1.getUpdatedAt()).isNotNull();
        verify(commentRepository).save(comment1);
    }

    @Test
    @DisplayName("deleteComment -> Ném NotFoundException khi bình luận không tồn tại")
    void deleteComment_notFound_throwsNotFoundException() {
        when(commentRepository.findByIdForUpdate(999)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminCommentService.deleteComment(999, "admin_master"))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("Không tìm thấy bình luận với ID: 999");

        verify(commentRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateCommentStatus -> Cập nhật trạng thái thành công sang rejected")
    void updateCommentStatus_success_transitionsStatus() {
        when(commentRepository.findByIdForUpdate(1)).thenReturn(Optional.of(comment1));
        when(commentRepository.save(any(Comment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(contentRepository.findById(100)).thenReturn(Optional.of(sampleContent));

        AdminCommentStatusRequest request = AdminCommentStatusRequest.builder()
                .status("REJECTED")
                .reason("Vi phạm chính sách cộng đồng")
                .build();

        AdminCommentResponse response = adminCommentService.updateCommentStatus(1, request, "admin_master");

        assertThat(response.getStatus()).isEqualTo("rejected");
        assertThat(comment1.getStatus()).isEqualTo("rejected");
        verify(commentRepository).save(comment1);
    }

    @Test
    @DisplayName("updateCommentStatus -> Ném BadRequestException khi trạng thái không hợp lệ")
    void updateCommentStatus_invalidStatus_throwsBadRequestException() {
        AdminCommentStatusRequest request = AdminCommentStatusRequest.builder()
                .status("INVALID_STATUS")
                .reason("Test")
                .build();

        assertThatThrownBy(() -> adminCommentService.updateCommentStatus(1, request, "admin_master"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Trạng thái không hợp lệ");

        verify(commentRepository, never()).save(any());
    }
}
