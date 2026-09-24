package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.ContentCreateRequest;
import com.fpt.swp391.nutribot.dto.request.ContentUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.AuthorContentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.service.AuthorContentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/author/blogs")
@RequiredArgsConstructor
public class BlogAuthorController {

    private final AuthorContentService authorContentService;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<AuthorContentResponse>>> getMyBlogs(
            @AuthenticationPrincipal UserDetails user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PagedResponse<AuthorContentResponse> response = authorContentService.getMyContent(user.getUsername(), "BLOG", page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AuthorContentResponse>> createBlog(
            @AuthenticationPrincipal UserDetails user,
            @Valid @RequestBody ContentCreateRequest request) {
        AuthorContentResponse response = authorContentService.createContent(user.getUsername(), "BLOG", request);
        return ResponseEntity.ok(ApiResponse.success("Tạo bài viết thành công", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AuthorContentResponse>> getBlogById(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer id) {
        AuthorContentResponse response = authorContentService.getContentById(user.getUsername(), id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<AuthorContentResponse>> updateBlog(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer id,
            @Valid @RequestBody ContentUpdateRequest request) {
        AuthorContentResponse response = authorContentService.updateContent(user.getUsername(), id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật bài viết thành công", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteBlog(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer id) {
        authorContentService.deleteContent(user.getUsername(), id);
        return ResponseEntity.ok(ApiResponse.success("Xóa bài viết thành công", null));
    }
}
