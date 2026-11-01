package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.AdminModerationRequest;
import com.fpt.swp391.nutribot.dto.response.AdminContentResponse;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.service.AdminModerationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử AdminModerationController - Lọc trạng thái và duyệt nội dung (Task NB-96)")
class AdminModerationControllerTest {

    @Mock
    private AdminModerationService adminModerationService;

    @InjectMocks
    private AdminModerationController adminModerationController;

    @Test
    @DisplayName("GET /api/v1/admin/moderation khi status=null -> thông điệp chờ duyệt")
    void getContents_defaultPendingMessage() {
        PagedResponse<AdminContentResponse> pagedResponse = PagedResponse.<AdminContentResponse>builder()
                .content(Collections.emptyList())
                .page(0)
                .size(10)
                .totalElements(0L)
                .totalPages(0)
                .first(true)
                .last(true)
                .build();

        when(adminModerationService.getContents(null, null, 0, 10)).thenReturn(pagedResponse);

        ResponseEntity<ApiResponse<PagedResponse<AdminContentResponse>>> response =
                adminModerationController.getContents(null, null, 0, 10);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isTrue();
        assertThat(response.getBody().getMessage()).isEqualTo("Lấy danh sách nội dung chờ duyệt thành công");
        assertThat(response.getBody().getData()).isEqualTo(pagedResponse);
        verify(adminModerationService).getContents(null, null, 0, 10);
    }

    @Test
    @DisplayName("GET /api/v1/admin/moderation khi status=published -> thông điệp đã duyệt")
    void getContents_publishedMessage() {
        PagedResponse<AdminContentResponse> pagedResponse = PagedResponse.<AdminContentResponse>builder()
                .content(Collections.emptyList())
                .page(0)
                .size(10)
                .totalElements(0L)
                .totalPages(0)
                .first(true)
                .last(true)
                .build();

        when(adminModerationService.getContents("published", "BLOG", 0, 10)).thenReturn(pagedResponse);

        ResponseEntity<ApiResponse<PagedResponse<AdminContentResponse>>> response =
                adminModerationController.getContents("published", "BLOG", 0, 10);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isTrue();
        assertThat(response.getBody().getMessage()).isEqualTo("Lấy danh sách nội dung đã duyệt thành công");
        assertThat(response.getBody().getData()).isEqualTo(pagedResponse);
        verify(adminModerationService).getContents("published", "BLOG", 0, 10);
    }

    @Test
    @DisplayName("GET /api/v1/admin/moderation khi status=rejected -> thông điệp đã từ chối")
    void getContents_rejectedMessage() {
        PagedResponse<AdminContentResponse> pagedResponse = PagedResponse.<AdminContentResponse>builder()
                .content(Collections.emptyList())
                .page(0)
                .size(10)
                .totalElements(0L)
                .totalPages(0)
                .first(true)
                .last(true)
                .build();

        when(adminModerationService.getContents("rejected", null, 0, 10)).thenReturn(pagedResponse);

        ResponseEntity<ApiResponse<PagedResponse<AdminContentResponse>>> response =
                adminModerationController.getContents("rejected", null, 0, 10);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isTrue();
        assertThat(response.getBody().getMessage()).isEqualTo("Lấy danh sách nội dung đã từ chối thành công");
        assertThat(response.getBody().getData()).isEqualTo(pagedResponse);
        verify(adminModerationService).getContents("rejected", null, 0, 10);
    }

    @Test
    @DisplayName("GET /api/v1/admin/moderation khi status khác -> thông điệp lấy danh sách nội dung thành công")
    void getContents_customStatusMessage() {
        PagedResponse<AdminContentResponse> pagedResponse = PagedResponse.<AdminContentResponse>builder()
                .content(Collections.emptyList())
                .page(0)
                .size(10)
                .totalElements(0L)
                .totalPages(0)
                .first(true)
                .last(true)
                .build();

        when(adminModerationService.getContents("archived", null, 0, 10)).thenReturn(pagedResponse);

        ResponseEntity<ApiResponse<PagedResponse<AdminContentResponse>>> response =
                adminModerationController.getContents("archived", null, 0, 10);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isTrue();
        assertThat(response.getBody().getMessage()).isEqualTo("Lấy danh sách nội dung thành công");
        verify(adminModerationService).getContents("archived", null, 0, 10);
    }

    @Test
    @DisplayName("PUT /api/v1/admin/moderation/{contentId}/action -> trả về kết quả duyệt thành công")
    void moderateContent_success() {
        AdminModerationRequest request = new AdminModerationRequest();
        request.setAction("APPROVE");

        AdminContentResponse mockResponse = AdminContentResponse.builder()
                .contentId(10)
                .status("published")
                .build();

        when(adminModerationService.moderateContent(eq(10), eq(request))).thenReturn(mockResponse);

        ResponseEntity<ApiResponse<AdminContentResponse>> response =
                adminModerationController.moderateContent(10, request);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isTrue();
        assertThat(response.getBody().getMessage()).isEqualTo("Duyệt nội dung thành công");
        assertThat(response.getBody().getData()).isEqualTo(mockResponse);
        verify(adminModerationService).moderateContent(10, request);
    }
}

