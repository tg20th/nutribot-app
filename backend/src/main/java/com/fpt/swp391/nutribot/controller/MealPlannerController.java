package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.MealPlanGenerateRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.MealPlanGenerateResponse;
import com.fpt.swp391.nutribot.service.MealPlannerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class MealPlannerController {

    private final MealPlannerService mealPlannerService;

    @PostMapping("/api/v1/meal-planner/generate")
    public ResponseEntity<ApiResponse<MealPlanGenerateResponse>> generate(
            @AuthenticationPrincipal UserDetails user,
            @Valid @RequestBody MealPlanGenerateRequest request) {
        MealPlanGenerateResponse response = mealPlannerService.generate(user.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success("AI đã tạo thực đơn thành công", response));
    }
}
