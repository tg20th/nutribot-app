package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.NutritionCalculationRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.NutritionCalculationResponse;
import com.fpt.swp391.nutribot.service.NutritionCalculationGatewayService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/author/nutrition")
@RequiredArgsConstructor
public class AuthorNutritionController {

    private final NutritionCalculationGatewayService nutritionCalculationGatewayService;

    @PostMapping("/calculate")
    public ResponseEntity<ApiResponse<NutritionCalculationResponse>> calculate(
            @Valid @RequestBody NutritionCalculationRequest request) {
        NutritionCalculationResponse response = nutritionCalculationGatewayService.calculateNutrition(request);
        return ResponseEntity.ok(ApiResponse.success("Tính toán dinh dưỡng thành công", response));
    }
}
