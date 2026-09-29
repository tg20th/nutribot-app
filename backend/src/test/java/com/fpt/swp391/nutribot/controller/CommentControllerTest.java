package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.CommentCreateRequest;
import com.fpt.swp391.nutribot.dto.request.CommentUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.CommentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.service.CommentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DisplayName("Kiểm thử CommentController (Task NB-27: Comment CRUD & Ownership)")
class CommentControllerTest {

    private CommentService commentService;
    private CommentController commentController;
    private UserDetails authenticatedUser;

    @BeforeEach
    void setUp() {
        commentService = mock(CommentService.class);
        commentController = new CommentController(commentService);
        authenticatedUser = new User("truong", "password", Collections.emptyList());
    }

    @Test
    @DisplayName("GET /api/v1/contents/{contentId}/comments -> Thành công trả về danh sách bình luận")
    void getComments_ReturnsPagedResponse() {
        PagedResponse<CommentResponse> pagedResponse = PagedResponse.<CommentResponse>builder()
                .content(Collections.emptyList())
                .page(0)
                .size(20)
                .totalElements(0L)
                .totalPages(0)
                .first(true)
                .last(true)
                .build();

        when(commentService.getCommentsByContentId(101, 0, 20)).thenReturn(pagedResponse);

        ResponseEntity<ApiResponse<PagedResponse<CommentResponse>>> response =
                commentController.getComments(101, 0, 20);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().isSuccess());
        verify(commentService).getCommentsByContentId(101, 0, 20);
    }

    @Test
    @DisplayName("POST /api/v1/contents/{contentId}/comments -> Thành công tạo bình luận mới")
    void createComment_WithValidRequest_ReturnsOk() {
        CommentCreateRequest request = new CommentCreateRequest("Bình luận hay quá!", null);
        CommentResponse commentResponse = CommentResponse.builder()
                .commentId(1)
                .contentId(101)
                .userId(1)
                .userName("truong")
                .body("Bình luận hay quá!")
                .build();

        when(commentService.createComment("truong", 101, request)).thenReturn(commentResponse);

        ResponseEntity<ApiResponse<CommentResponse>> response =
                commentController.createComment(authenticatedUser, 101, request);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().isSuccess());
        assertEquals("Bình luận hay quá!", response.getBody().getData().getBody());
        verify(commentService).createComment("truong", 101, request);
    }

    @Test
    @DisplayName("PUT /api/v1/comments/{commentId} -> Thành công chỉnh sửa bình luận")
    void updateComment_WithValidRequest_ReturnsOk() {
        CommentUpdateRequest request = new CommentUpdateRequest("Bình luận đã sửa lại");
        CommentResponse commentResponse = CommentResponse.builder()
                .commentId(1)
                .contentId(101)
                .userId(1)
                .userName("truong")
                .body("Bình luận đã sửa lại")
                .build();

        when(commentService.updateComment("truong", 1, request)).thenReturn(commentResponse);

        ResponseEntity<ApiResponse<CommentResponse>> response =
                commentController.updateComment(authenticatedUser, 1, request);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().isSuccess());
        assertEquals("Bình luận đã sửa lại", response.getBody().getData().getBody());
        verify(commentService).updateComment("truong", 1, request);
    }

    @Test
    @DisplayName("DELETE /api/v1/comments/{commentId} -> Thành công xóa bình luận")
    void deleteComment_ReturnsOk() {
        doNothing().when(commentService).deleteComment("truong", 1);

        ResponseEntity<ApiResponse<Void>> response =
                commentController.deleteComment(authenticatedUser, 1);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().isSuccess());
        verify(commentService).deleteComment("truong", 1);
    }
}
