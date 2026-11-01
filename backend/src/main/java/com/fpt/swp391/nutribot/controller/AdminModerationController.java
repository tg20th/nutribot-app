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
    public ResponseEntity<ApiResponse<PagedResponse<AdminContentResponse>>> getContents(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String contentType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PagedResponse<AdminContentResponse> result = adminModerationService.getContents(status, contentType, page, size);
        return ResponseEntity.ok(ApiResponse.success(resolveMessage(status), result));
    }

    @PutMapping("/{contentId}/action")
    public ResponseEntity<ApiResponse<AdminContentResponse>> moderateContent(
            @PathVariable Integer contentId,
            @Valid @RequestBody AdminModerationRequest request) {
        AdminContentResponse result = adminModerationService.moderateContent(contentId, request);
        return ResponseEntity.ok(ApiResponse.success("Duyệt nội dung thành công", result));
    }

    private String resolveMessage(String status) {
        if (status == null || status.isBlank() || "pending".equalsIgnoreCase(status.trim()) || "under_review".equalsIgnoreCase(status.trim())) {
            return "Lấy danh sách nội dung chờ duyệt thành công";
        }
        String s = status.trim().toLowerCase();
        return switch (s) {
            case "published" -> "Lấy danh sách nội dung đã duyệt thành công";
            case "rejected" -> "Lấy danh sách nội dung đã từ chối thành công";
            default -> "Lấy danh sách nội dung thành công";
        };
    }
}
