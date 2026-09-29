package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.NutritionTargetResponse;
import com.fpt.swp391.nutribot.service.NutritionTargetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/users/profile")
public class NutritionTargetController {

    private final NutritionTargetService nutritionTargetService;

    @GetMapping("/nutrition-target")
    public ResponseEntity<ApiResponse<NutritionTargetResponse>> getNutritionTarget(Principal principal) {
        NutritionTargetResponse target = nutritionTargetService.calculateTarget(principal.getName());
        return ResponseEntity.ok(ApiResponse.success(
                "Tính nutrition target thành công",
                target));
    }
}
