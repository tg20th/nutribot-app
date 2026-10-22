package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.ContentRecipeSuggestionReviewRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.ContentRecipeSuggestionResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.service.ContentRecipeSuggestionReviewService;
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
@DisplayName("Kiểm thử AdminContentRecipeSuggestionController (NB-61)")
class AdminContentRecipeSuggestionControllerTest {

    @Mock
    private ContentRecipeSuggestionReviewService reviewService;

    @Mock
    private com.fpt.swp391.nutribot.service.RecipeSuggestionAuditService auditService;

    @Mock
    private Authentication authentication;

    @InjectMocks
    private AdminContentRecipeSuggestionController controller;

    private ContentRecipeSuggestionResponse sampleResponse() {
        return ContentRecipeSuggestionResponse.builder()
                .suggestionId(700)
                .status("PENDING")
                .dish(ContentRecipeSuggestionResponse.DishInfo.builder().name("Bún gạo lứt rau củ").build())
                .build();
    }

    @Test
    @DisplayName("GET /api/v1/admin/content-recipe-suggestions -> trả PagedResponse trong ApiResponse")
    void listSuggestions_success() {
        PagedResponse<ContentRecipeSuggestionResponse> paged = PagedResponse.<ContentRecipeSuggestionResponse>builder()
                .content(Collections.emptyList())
                .page(0)
                .size(10)
                .totalElements(0L)
                .totalPages(0)
                .first(true)
                .last(true)
                .build();
        when(reviewService.list("PENDING", 0, 10)).thenReturn(paged);

        ResponseEntity<ApiResponse<PagedResponse<ContentRecipeSuggestionResponse>>> response =
                controller.listSuggestions("PENDING", 0, 10);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isTrue();
        assertThat(response.getBody().getData()).isEqualTo(paged);
        verify(reviewService).list("PENDING", 0, 10);
    }

    @Test
    @DisplayName("GET /{id} -> trả chi tiết đề xuất")
    void getSuggestion_success() {
        when(reviewService.getById(700)).thenReturn(sampleResponse());

        ResponseEntity<ApiResponse<ContentRecipeSuggestionResponse>> response = controller.getSuggestion(700);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData().getSuggestionId()).isEqualTo(700);
        verify(reviewService).getById(700);
    }

    @Test
    @DisplayName("PUT /{id}/review -> truyền username admin và trả kết quả")
    void reviewSuggestion_success() {
        ContentRecipeSuggestionReviewRequest request = new ContentRecipeSuggestionReviewRequest();
        request.setAction("APPROVE");
        ContentRecipeSuggestionResponse reviewed = sampleResponse();
        reviewed.setStatus("APPROVED");

        when(authentication.getName()).thenReturn("admin_master");
        when(reviewService.review(700, request, "admin_master")).thenReturn(reviewed);

        ResponseEntity<ApiResponse<ContentRecipeSuggestionResponse>> response =
                controller.reviewSuggestion(700, request, authentication);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().isSuccess()).isTrue();
        assertThat(response.getBody().getData().getStatus()).isEqualTo("APPROVED");
        verify(reviewService).review(700, request, "admin_master");
    }
}
