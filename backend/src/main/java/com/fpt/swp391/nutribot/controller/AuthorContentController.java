package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.ContentCreateRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.AuthorContentResponse;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.service.AuthorContentService;
import com.fpt.swp391.nutribot.service.CloudinaryMediaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/** Canonical author API: one post can be either BLOG or VIDEO. */
@RestController
@RequestMapping("/api/v1/author/contents")
@RequiredArgsConstructor
public class AuthorContentController {
    private final AuthorContentService authorContentService;
    private final CloudinaryMediaService cloudinaryMediaService;
    private final UserRepository userRepository;

    @PostMapping
    public ResponseEntity<ApiResponse<AuthorContentResponse>> createContent(
            @AuthenticationPrincipal UserDetails user, @Valid @RequestBody ContentCreateRequest request) {
        AuthorContentResponse response = authorContentService.createContent(user.getUsername(), request.getContentType(), request);
        return ResponseEntity.ok(ApiResponse.success("Tạo nội dung thành công", response));
    }

    @PostMapping("/video")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadVideo(
            @AuthenticationPrincipal UserDetails userDetails, @RequestParam("file") MultipartFile file) {
        if (userDetails == null) throw new BadRequestException("Vui lòng đăng nhập để tải video lên");
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));
        CloudinaryMediaService.MediaUploadResult result = cloudinaryMediaService.uploadVideo(file, user.getUserId());
        return ResponseEntity.ok(ApiResponse.success("Tải video lên thành công", Map.of("mediaUrl", result.secureUrl())));
    }
}
