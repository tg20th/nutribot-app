package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.AdminCommentStatusRequest;
import com.fpt.swp391.nutribot.dto.response.AdminCommentResponse;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.service.AdminCommentService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử AdminCommentController - Phân quyền và endpoint API Quản trị Bình luận (Task NB-40)")
class AdminCommentControllerTest {

    @Mock
    private AdminCommentService adminCommentService;

    @Mock
    private Authentication authentication;

    @InjectMocks
    private AdminCommentController adminCommentController;

    @Test
    @DisplayName("GET /api/v1/admin/comments -> Trả về PagedResponse trong bọc ApiResponse")
    void getAllComments_success_returnsPagedResponse() {
        PagedResponse<AdminCommentResponse> pagedResponse = PagedResponse.<AdminCommentResponse>builder()
                .content(Collections.emptyList())
                .page(0)
                .size(10)
                .totalElements(0L)
                .totalPages(0)
                .first(true)
                .last(true)
                .build();

        when(adminCommentService.getAllComments("spam", "hidden", 0, 10)).thenReturn(pagedResponse);

        ResponseEntity<ApiResponse<PagedResponse<AdminCommentResponse>>> response =
                adminCommentController.getAllComments("spam", "hidden", 0, 10);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isTrue();
        assertThat(response.getBody().getData()).isEqualTo(pagedResponse);

        verify(adminCommentService).getAllComments("spam", "hidden", 0, 10);
    }

    @Test
    @DisplayName("DELETE /api/v1/admin/comments/{id} -> Xóa thành công (Soft delete) và trả về null data")
    void deleteComment_success_callsServiceAndReturnsNullData() {
        when(authentication.getName()).thenReturn("admin_master");
        doNothing().when(adminCommentService).deleteComment(5, "admin_master");

        ResponseEntity<ApiResponse<Void>> response = adminCommentController.deleteComment(5, authentication);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isTrue();
        assertThat(response.getBody().getData()).isNull();
        assertThat(response.getBody().getMessage()).isEqualTo("Xóa bình luận thành công");

        verify(adminCommentService).deleteComment(5, "admin_master");
    }

    @Test
    @DisplayName("PUT /api/v1/admin/comments/{id}/status -> Cập nhật trạng thái kiểm duyệt thành công")
    void updateCommentStatus_success_callsServiceAndReturnsUpdatedComment() {
        AdminCommentStatusRequest request = AdminCommentStatusRequest.builder()
                .status("HIDDEN")
                .reason("Nội dung phản cảm")
                .build();

        AdminCommentResponse responseDto = AdminCommentResponse.builder()
                .commentId(5)
                .status("hidden")
                .body("Bình luận bị ẩn")
                .build();

        when(authentication.getName()).thenReturn("admin_master");
        when(adminCommentService.updateCommentStatus(5, request, "admin_master")).thenReturn(responseDto);

        ResponseEntity<ApiResponse<AdminCommentResponse>> response =
                adminCommentController.updateCommentStatus(5, request, authentication);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isTrue();
        assertThat(response.getBody().getData().getStatus()).isEqualTo("hidden");

        verify(adminCommentService).updateCommentStatus(5, request, "admin_master");
    }
}
