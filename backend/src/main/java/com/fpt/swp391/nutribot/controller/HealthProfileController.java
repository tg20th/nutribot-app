package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.HealthProfileUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.HealthProfileResponse;
import com.fpt.swp391.nutribot.dto.response.IngredientOptionResponse;
import com.fpt.swp391.nutribot.service.HealthProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class HealthProfileController {

    private final HealthProfileService healthProfileService;

    @GetMapping("/api/v1/users/profile/health")
    public ResponseEntity<ApiResponse<HealthProfileResponse>> getHealthProfile(Principal principal) {
        return ResponseEntity.ok(ApiResponse.success(
                "Health profile loaded successfully.",
                healthProfileService.getHealthProfile(principal.getName())));
    }

    @PutMapping("/api/v1/users/profile/health")
    public ResponseEntity<ApiResponse<HealthProfileResponse>> updateHealthProfile(
            Principal principal,
            @Valid @RequestBody HealthProfileUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Health profile updated successfully.",
                healthProfileService.updateHealthProfile(principal.getName(), request)));
    }

    @GetMapping("/api/v1/ingredients")
    public ResponseEntity<ApiResponse<List<IngredientOptionResponse>>> getIngredients() {
        return ResponseEntity.ok(ApiResponse.success(
                "Ingredients loaded successfully.",
                healthProfileService.getActiveIngredients()));
    }
}
