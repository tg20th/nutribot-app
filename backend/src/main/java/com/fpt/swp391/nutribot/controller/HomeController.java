package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.HomeSummaryResponse;
import com.fpt.swp391.nutribot.service.HomeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/home")
@RequiredArgsConstructor
public class HomeController {

    private final HomeService homeService;

    @GetMapping
    public ResponseEntity<ApiResponse<HomeSummaryResponse>> getHomeSummary() {
        HomeSummaryResponse response = homeService.getHomeSummary();
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
