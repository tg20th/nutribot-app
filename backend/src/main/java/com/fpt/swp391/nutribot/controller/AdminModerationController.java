package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.AdminModerationRequest;
import com.fpt.swp391.nutribot.dto.response.AdminContentResponse;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.service.AdminModerationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/moderation")
@RequiredArgsConstructor
public class AdminModerationController {

    private final AdminModerationService adminModerationService;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<AdminContentResponse>>> getPendingContents(
            @RequestParam(required = false) String contentType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PagedResponse<AdminContentResponse> result = adminModerationService.getPendingContents(contentType, page, size);
        return ResponseEntity.ok(ApiResponse.success("Lấy danh sách nội dung chờ duyệt thành công", result));
    }

    @PutMapping("/{contentId}/action")
    public ResponseEntity<ApiResponse<AdminContentResponse>> moderateContent(
            @PathVariable Integer contentId,
            @Valid @RequestBody AdminModerationRequest request) {
        AdminContentResponse result = adminModerationService.moderateContent(contentId, request);
        return ResponseEntity.ok(ApiResponse.success("Duyệt nội dung thành công", result));
    }
}
