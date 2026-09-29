package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.service.CloudinaryMediaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class BlogThumbnailController {

    private final CloudinaryMediaService cloudinaryMediaService;
    private final UserRepository userRepository;

    @PostMapping({
            "/api/v1/blogs/thumbnails",
            "/api/v1/author/blogs/thumbnail",
            "/api/v1/videos/thumbnails",
            "/api/v1/author/videos/thumbnail"
    })
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadThumbnail(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam("file") MultipartFile file) {

        if (userDetails == null) {
            throw new BadRequestException("Vui lòng đăng nhập để tải ảnh lên");
        }

        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        CloudinaryMediaService.MediaUploadResult result = cloudinaryMediaService.uploadThumbnail(file, user.getUserId());
        return ResponseEntity.ok(ApiResponse.success(
                "Tải ảnh thu nhỏ lên thành công",
                Map.of("thumbnailUrl", result.secureUrl())
        ));
    }
}
