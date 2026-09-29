package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.ContentCreateRequest;
import com.fpt.swp391.nutribot.dto.request.ContentUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.AuthorContentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.service.AuthorContentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DisplayName("Kiểm thử VideoAuthorController (Author Video CRUD, Submit & Recall - Task NB-24)")
class VideoAuthorControllerTest {

    private AuthorContentService authorContentService;
    private VideoAuthorController videoAuthorController;
    private UserDetails authorUserDetails;

    @BeforeEach
    void setUp() {
        authorContentService = mock(AuthorContentService.class);
        videoAuthorController = new VideoAuthorController(authorContentService);
        authorUserDetails = User.withUsername("author_user")
                .password("password")
                .roles("USER")
                .build();
    }

    @Test
    @DisplayName("GET /api/v1/author/videos -> Lấy danh sách video của tác giả")
    void getMyVideos_returnsPagedList() {
        PagedResponse<AuthorContentResponse> pagedResponse = PagedResponse.<AuthorContentResponse>builder()
                .content(Collections.emptyList())
                .page(0)
                .size(10)
                .totalElements(0L)
                .totalPages(0)
                .first(true)
                .last(true)
                .build();

        when(authorContentService.getMyContent("author_user", "VIDEO", 0, 10))
                .thenReturn(pagedResponse);

        ResponseEntity<ApiResponse<PagedResponse<AuthorContentResponse>>> response =
                videoAuthorController.getMyVideos(authorUserDetails, 0, 10);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().isSuccess());
        verify(authorContentService).getMyContent("author_user", "VIDEO", 0, 10);
    }

    @Test
    @DisplayName("POST /api/v1/author/videos -> Tạo video mới thành công")
    void createVideo_createsNewVideo() {
        ContentCreateRequest request = ContentCreateRequest.builder()
                .title("Video Món Chay")
                .mediaUrl("https://example.com/v1.mp4")
                .durationSec(120)
                .build();

        AuthorContentResponse authorResponse = AuthorContentResponse.builder()
                .contentId(200)
                .contentType("VIDEO")
                .title("Video Món Chay")
                .status("draft")
                .build();

        when(authorContentService.createContent("author_user", "VIDEO", request))
                .thenReturn(authorResponse);

        ResponseEntity<ApiResponse<AuthorContentResponse>> response =
                videoAuthorController.createVideo(authorUserDetails, request);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertEquals("Tạo video thành công", response.getBody().getMessage());
        assertEquals(200, response.getBody().getData().getContentId());
        verify(authorContentService).createContent("author_user", "VIDEO", request);
    }

    @Test
    @DisplayName("GET /api/v1/author/videos/{id} -> Lấy chi tiết video")
    void getVideoById_returnsVideoDetail() {
        AuthorContentResponse authorResponse = AuthorContentResponse.builder()
                .contentId(200)
                .contentType("VIDEO")
                .title("Video Món Chay")
                .build();

        when(authorContentService.getContentById("author_user", 200, "VIDEO"))
                .thenReturn(authorResponse);

        ResponseEntity<ApiResponse<AuthorContentResponse>> response =
                videoAuthorController.getVideoById(authorUserDetails, 200);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertEquals(200, response.getBody().getData().getContentId());
        verify(authorContentService).getContentById("author_user", 200, "VIDEO");
    }

    @Test
    @DisplayName("PUT /api/v1/author/videos/{id} -> Cập nhật video")
    void updateVideo_updatesVideoContent() {
        ContentUpdateRequest request = ContentUpdateRequest.builder()
                .title("Video Món Chay Mới")
                .durationSec(180)
                .build();

        AuthorContentResponse authorResponse = AuthorContentResponse.builder()
                .contentId(200)
                .contentType("VIDEO")
                .title("Video Món Chay Mới")
                .build();

        when(authorContentService.updateContent("author_user", 200, "VIDEO", request))
                .thenReturn(authorResponse);

        ResponseEntity<ApiResponse<AuthorContentResponse>> response =
                videoAuthorController.updateVideo(authorUserDetails, 200, request);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertEquals("Cập nhật video thành công", response.getBody().getMessage());
        verify(authorContentService).updateContent("author_user", 200, "VIDEO", request);
    }

    @Test
    @DisplayName("DELETE /api/v1/author/videos/{id} -> Xóa video")
    void deleteVideo_deletesVideo() {
        doNothing().when(authorContentService).deleteContent("author_user", 200, "VIDEO");

        ResponseEntity<ApiResponse<Void>> response =
                videoAuthorController.deleteVideo(authorUserDetails, 200);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertEquals("Xóa video thành công", response.getBody().getMessage());
        verify(authorContentService).deleteContent("author_user", 200, "VIDEO");
    }

    @Test
    @DisplayName("POST /api/v1/author/videos/{id}/submit -> Nộp video chờ duyệt")
    void submitVideo_submitsForReview() {
        AuthorContentResponse authorResponse = AuthorContentResponse.builder()
                .contentId(200)
                .contentType("VIDEO")
                .status("under_review")
                .build();

        when(authorContentService.submitContent("author_user", 200, "VIDEO"))
                .thenReturn(authorResponse);

        ResponseEntity<ApiResponse<AuthorContentResponse>> response =
                videoAuthorController.submitVideo(authorUserDetails, 200);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertEquals("Nộp video chờ duyệt thành công", response.getBody().getMessage());
        assertEquals("under_review", response.getBody().getData().getStatus());
        verify(authorContentService).submitContent("author_user", 200, "VIDEO");
    }

    @Test
    @DisplayName("POST /api/v1/author/videos/{id}/recall -> Rút video về bản nháp")
    void recallVideo_recallsToDraft() {
        AuthorContentResponse authorResponse = AuthorContentResponse.builder()
                .contentId(200)
                .contentType("VIDEO")
                .status("draft")
                .build();

        when(authorContentService.recallContent("author_user", 200, "VIDEO"))
                .thenReturn(authorResponse);

        ResponseEntity<ApiResponse<AuthorContentResponse>> response =
                videoAuthorController.recallVideo(authorUserDetails, 200);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertEquals("Rút video về bản nháp thành công", response.getBody().getMessage());
        assertEquals("draft", response.getBody().getData().getStatus());
        verify(authorContentService).recallContent("author_user", 200, "VIDEO");
    }
}
