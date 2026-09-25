package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.AdminCommentResponse;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.service.AdminCommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/comments")
@RequiredArgsConstructor
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
    public ResponseEntity<ApiResponse<Void>> deleteComment(@PathVariable Integer commentId) {
        adminCommentService.deleteComment(commentId);
        return ResponseEntity.ok(ApiResponse.success("Xóa bình luận thành công", null));
    }
}
