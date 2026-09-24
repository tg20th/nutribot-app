package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.CommentCreateRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.CommentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.service.CommentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    @GetMapping("/api/v1/contents/{contentId}/comments")
    public ResponseEntity<ApiResponse<PagedResponse<CommentResponse>>> getComments(
            @PathVariable Integer contentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PagedResponse<CommentResponse> response = commentService.getCommentsByContentId(contentId, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/api/v1/contents/{contentId}/comments")
    public ResponseEntity<ApiResponse<CommentResponse>> createComment(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer contentId,
            @Valid @RequestBody CommentCreateRequest request) {
        CommentResponse response = commentService.createComment(user.getUsername(), contentId, request);
        return ResponseEntity.ok(ApiResponse.success("Bình luận thành công", response));
    }

    @DeleteMapping("/api/v1/comments/{commentId}")
    public ResponseEntity<ApiResponse<Void>> deleteComment(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer commentId) {
        commentService.deleteComment(user.getUsername(), commentId);
        return ResponseEntity.ok(ApiResponse.success("Xóa bình luận thành công", null));
    }
}
