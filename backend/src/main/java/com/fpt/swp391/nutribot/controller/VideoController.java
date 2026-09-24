package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.dto.response.VideoListResponse;
import com.fpt.swp391.nutribot.dto.response.VideoDetailResponse;
import com.fpt.swp391.nutribot.service.ContentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/videos")
@RequiredArgsConstructor
public class VideoController {

    private final ContentService contentService;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<VideoListResponse>>> getVideos(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PagedResponse<VideoListResponse> response = contentService.getPublishedVideos(page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<ApiResponse<VideoDetailResponse>> getVideoBySlug(@PathVariable String slug) {
        VideoDetailResponse response = contentService.getVideoBySlug(slug);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/id/{id}")
    public ResponseEntity<ApiResponse<VideoDetailResponse>> getVideoById(@PathVariable Integer id) {
        VideoDetailResponse response = contentService.getVideoById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
