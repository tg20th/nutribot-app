package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.AdminCommentStatusRequest;
import com.fpt.swp391.nutribot.dto.response.AdminCommentResponse;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.service.AdminCommentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/comments")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminCommentController {

    private final AdminCommentService adminCommentService;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<AdminCommentResponse>>> getAllComments(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PagedResponse<AdminCommentResponse> result = adminCommentService.getAllComments(keyword, status, page, size);
        return ResponseEntity.ok(ApiResponse.success("Lấy danh sách bình luận thành công", result));
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<ApiResponse<Void>> deleteComment(
            @PathVariable Integer commentId,
            Authentication authentication) {
        String adminUsername = authentication != null ? authentication.getName() : "ADMIN";
        adminCommentService.deleteComment(commentId, adminUsername);
        return ResponseEntity.ok(ApiResponse.success("Xóa bình luận thành công", null));
    }

    @PutMapping("/{commentId}/status")
    public ResponseEntity<ApiResponse<AdminCommentResponse>> updateCommentStatus(
            @PathVariable Integer commentId,
            @Valid @RequestBody AdminCommentStatusRequest request,
            Authentication authentication) {
        String adminUsername = authentication != null ? authentication.getName() : "ADMIN";
        AdminCommentResponse result = adminCommentService.updateCommentStatus(commentId, request, adminUsername);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật trạng thái bình luận thành công", result));
    }
}
