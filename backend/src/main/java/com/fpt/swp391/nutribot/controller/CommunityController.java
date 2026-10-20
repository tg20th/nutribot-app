package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.CommunityHighlightResponse;
import com.fpt.swp391.nutribot.service.ContentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/community")
@RequiredArgsConstructor
public class CommunityController {

    private final ContentService contentService;

    @GetMapping("/highlights")
    public ResponseEntity<ApiResponse<List<CommunityHighlightResponse>>> getHighlights(
            @RequestParam(defaultValue = "3") int limit) {
        return ResponseEntity.ok(ApiResponse.success(contentService.getCommunityHighlights(limit)));
    }
}
