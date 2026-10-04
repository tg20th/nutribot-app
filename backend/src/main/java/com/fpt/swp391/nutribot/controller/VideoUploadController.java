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
public class VideoUploadController {

    private final CloudinaryMediaService cloudinaryMediaService;
    private final UserRepository userRepository;

    @PostMapping("/api/v1/author/videos/upload")
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadVideo(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam("file") MultipartFile file) {

        if (userDetails == null) {
            throw new BadRequestException("Vui lòng đăng nhập để tải video lên");
        }

        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        CloudinaryMediaService.MediaUploadResult result = cloudinaryMediaService.uploadVideo(file, user.getUserId());
        return ResponseEntity.ok(ApiResponse.success(
                "Tải video lên thành công",
                Map.of(
                        "mediaUrl", result.secureUrl(),
                        "publicId", result.publicId()
                )
        ));
    }
}
