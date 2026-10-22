package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.ContentRecipeSuggestionReviewRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.ContentRecipeSuggestionResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.dto.response.RecipeSuggestionAuditResponse;
import com.fpt.swp391.nutribot.service.ContentRecipeSuggestionReviewService;
import com.fpt.swp391.nutribot.service.RecipeSuggestionAuditService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/content-recipe-suggestions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminContentRecipeSuggestionController {

    private final ContentRecipeSuggestionReviewService reviewService;
    private final RecipeSuggestionAuditService auditService;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<ContentRecipeSuggestionResponse>>> listSuggestions(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PagedResponse<ContentRecipeSuggestionResponse> result = reviewService.list(status, page, size);
        return ResponseEntity.ok(ApiResponse.success("Lấy danh sách đề xuất món ăn thành công", result));
    }

    @GetMapping("/{suggestionId}")
    public ResponseEntity<ApiResponse<ContentRecipeSuggestionResponse>> getSuggestion(
            @PathVariable Integer suggestionId) {
        ContentRecipeSuggestionResponse result = reviewService.getById(suggestionId);
        return ResponseEntity.ok(ApiResponse.success("Lấy chi tiết đề xuất món ăn thành công", result));
    }

    @PutMapping("/{suggestionId}/review")
    public ResponseEntity<ApiResponse<ContentRecipeSuggestionResponse>> reviewSuggestion(
            @PathVariable Integer suggestionId,
            @Valid @RequestBody ContentRecipeSuggestionReviewRequest request,
            Authentication authentication) {
        String adminUsername = authentication != null ? authentication.getName() : null;
        ContentRecipeSuggestionResponse result = reviewService.review(suggestionId, request, adminUsername);
        return ResponseEntity.ok(ApiResponse.success("Xử lý đề xuất món ăn thành công", result));
    }

    /**
     * NB-84: Nhat ky vong doi trang thai cua de xuat (de doi soat lai duong).
     */
    @GetMapping("/{suggestionId}/audit")
    public ResponseEntity<ApiResponse<List<RecipeSuggestionAuditResponse>>> getSuggestionAudit(
            @PathVariable Integer suggestionId) {
        List<RecipeSuggestionAuditResponse> result = auditService.listBySuggestion(suggestionId);
        return ResponseEntity.ok(ApiResponse.success("Lấy nhật ký đề xuất món ăn thành công", result));
    }
}
