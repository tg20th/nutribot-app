package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.dto.response.VideoDetailResponse;
import com.fpt.swp391.nutribot.dto.response.VideoListResponse;
import com.fpt.swp391.nutribot.service.ContentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DisplayName("Kiểm thử VideoController (Public Video APIs - Task NB-22)")
class VideoControllerTest {

    private ContentService contentService;
    private VideoController videoController;

    @BeforeEach
    void setUp() {
        contentService = mock(ContentService.class);
        videoController = new VideoController(contentService);
    }

    @Test
    @DisplayName("GET /api/v1/videos -> Gọi getPublishedVideos với page, size, categoryId")
    void getVideos_DelegatesToContentService() {
        PagedResponse<VideoListResponse> pagedResponse = PagedResponse.<VideoListResponse>builder()
                .content(Collections.emptyList())
                .page(0)
                .size(10)
                .totalElements(0L)
                .totalPages(0)
                .first(true)
                .last(true)
                .build();

        when(contentService.getPublishedVideos(0, 10, 5)).thenReturn(pagedResponse);

        ResponseEntity<ApiResponse<PagedResponse<VideoListResponse>>> response =
                videoController.getVideos(0, 10, 5);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().isSuccess());
        verify(contentService).getPublishedVideos(0, 10, 5);
    }

    @Test
    @DisplayName("GET /api/v1/videos/{slugOrId} -> Gọi getVideoByIdOrSlug")
    void getVideoBySlugOrId_DelegatesToContentService() {
        VideoDetailResponse detail = VideoDetailResponse.builder()
                .contentId(201)
                .title("Video test")
                .build();

        when(contentService.getVideoByIdOrSlug("video-slug")).thenReturn(detail);

        ResponseEntity<ApiResponse<VideoDetailResponse>> response =
                videoController.getVideoBySlugOrId("video-slug");

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertEquals(201, response.getBody().getData().getContentId());
        verify(contentService).getVideoByIdOrSlug("video-slug");
    }

    @Test
    @DisplayName("GET /api/v1/videos/id/{id} -> Gọi getVideoById")
    void getVideoById_DelegatesToContentService() {
        VideoDetailResponse detail = VideoDetailResponse.builder()
                .contentId(201)
                .title("Video test")
                .build();

        when(contentService.getVideoById(201)).thenReturn(detail);

        ResponseEntity<ApiResponse<VideoDetailResponse>> response =
                videoController.getVideoById(201);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertEquals(201, response.getBody().getData().getContentId());
        verify(contentService).getVideoById(201);
    }
}
