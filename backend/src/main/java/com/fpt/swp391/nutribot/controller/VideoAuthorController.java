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
@RequestMapping("/api/v1/author/videos")
@RequiredArgsConstructor
public class VideoAuthorController {

    private final AuthorContentService authorContentService;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<AuthorContentResponse>>> getMyVideos(
            @AuthenticationPrincipal UserDetails user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PagedResponse<AuthorContentResponse> response = authorContentService.getMyContent(user.getUsername(), "VIDEO", page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AuthorContentResponse>> createVideo(
            @AuthenticationPrincipal UserDetails user,
            @Valid @RequestBody ContentCreateRequest request) {
        AuthorContentResponse response = authorContentService.createContent(user.getUsername(), "VIDEO", request);
        return ResponseEntity.ok(ApiResponse.success("Video created successfully.", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AuthorContentResponse>> getVideoById(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer id) {
        AuthorContentResponse response = authorContentService.getContentById(user.getUsername(), id, "VIDEO");
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<AuthorContentResponse>> updateVideo(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer id,
            @Valid @RequestBody ContentUpdateRequest request) {
        AuthorContentResponse response = authorContentService.updateContent(user.getUsername(), id, "VIDEO", request);
        return ResponseEntity.ok(ApiResponse.success("Video updated successfully.", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteVideo(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer id) {
        authorContentService.deleteContent(user.getUsername(), id, "VIDEO");
        return ResponseEntity.ok(ApiResponse.success("Video deleted successfully.", null));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<ApiResponse<AuthorContentResponse>> submitVideo(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer id) {
        AuthorContentResponse response = authorContentService.submitContent(user.getUsername(), id, "VIDEO");
        String message = "published".equalsIgnoreCase(response.getStatus())
                ? "Video auto-moderated and published successfully."
                : "Video submitted for review successfully.";
        return ResponseEntity.ok(ApiResponse.success(message, response));
    }

    @PostMapping("/{id}/recall")
    public ResponseEntity<ApiResponse<AuthorContentResponse>> recallVideo(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer id) {
        AuthorContentResponse response = authorContentService.recallContent(user.getUsername(), id, "VIDEO");
        return ResponseEntity.ok(ApiResponse.success("Video recalled to draft successfully.", response));
    }
}
