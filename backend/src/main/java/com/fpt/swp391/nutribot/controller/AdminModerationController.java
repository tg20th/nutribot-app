package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.AdminModerationRequest;
import com.fpt.swp391.nutribot.dto.response.*;
import com.fpt.swp391.nutribot.service.AdminModerationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController @RequestMapping("/api/v1/admin/moderation") @RequiredArgsConstructor @PreAuthorize("hasRole('ADMIN')")
public class AdminModerationController {
    private final AdminModerationService adminModerationService;
    @GetMapping public ResponseEntity<ApiResponse<PagedResponse<AdminContentResponse>>> getPendingContents(@RequestParam(required = false) String contentType, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) { return ResponseEntity.ok(ApiResponse.success("Pending moderation content loaded", adminModerationService.getPendingContents(contentType, page, size))); }
    @PutMapping("/{contentId}/action") public ResponseEntity<ApiResponse<AdminContentResponse>> moderateContent(@PathVariable Integer contentId, @Valid @RequestBody AdminModerationRequest request, Authentication authentication) { return ResponseEntity.ok(ApiResponse.success("Content moderated", adminModerationService.moderateContent(contentId, request, authentication == null ? null : authentication.getName()))); }
    @GetMapping("/history") public ResponseEntity<ApiResponse<PagedResponse<ModerationAuditResponse>>> history(@RequestParam(required = false) String query, @RequestParam(required = false) String action, @RequestParam(required = false) String contentType, @RequestParam(required = false) String adminUsername, @RequestParam(required = false) LocalDate from, @RequestParam(required = false) LocalDate to, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) { return ResponseEntity.ok(ApiResponse.success("Moderation history loaded", adminModerationService.getHistory(query, action, contentType, adminUsername, from, to, page, size))); }
    @GetMapping("/history/{auditId}") public ResponseEntity<ApiResponse<ModerationAuditResponse>> historyDetail(@PathVariable Long auditId) { return ResponseEntity.ok(ApiResponse.success("Moderation audit loaded", adminModerationService.getHistoryDetail(auditId))); }
    @GetMapping("/contents/{contentId}/timeline") public ResponseEntity<ApiResponse<List<ModerationAuditResponse>>> timeline(@PathVariable Integer contentId) { return ResponseEntity.ok(ApiResponse.success("Moderation timeline loaded", adminModerationService.getTimeline(contentId))); }
}
