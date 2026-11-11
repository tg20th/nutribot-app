package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.ContentEngagementRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.entity.ContentViewEvent;
import com.fpt.swp391.nutribot.service.ContentEngagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/contents") @RequiredArgsConstructor
public class ContentEngagementController {
    private final ContentEngagementService service;
    @PostMapping("/{contentId}/engagement")
    public ResponseEntity<ApiResponse<ContentViewEvent>> record(@PathVariable Integer contentId, @Valid @RequestBody ContentEngagementRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(ApiResponse.success("Engagement recorded", service.record(contentId, username, request)));
    }
}
