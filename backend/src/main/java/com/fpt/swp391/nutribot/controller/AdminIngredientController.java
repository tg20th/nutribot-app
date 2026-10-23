package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.IngredientCreateRequest;
import com.fpt.swp391.nutribot.dto.request.IngredientStatusRequest;
import com.fpt.swp391.nutribot.dto.request.IngredientUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.AdminIngredientResponse;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.service.AdminIngredientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/ingredients")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminIngredientController {
    private final AdminIngredientService adminIngredientService;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<AdminIngredientResponse>>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer categoryId,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success("Ingredients retrieved successfully.",
                adminIngredientService.list(keyword, categoryId, active, page, size)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AdminIngredientResponse>> create(
            @Valid @RequestBody IngredientCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(
                "Ingredient created successfully.", adminIngredientService.create(request)));
    }

    @PutMapping("/{ingredientId}")
    public ResponseEntity<ApiResponse<AdminIngredientResponse>> update(
            @PathVariable Integer ingredientId,
            @Valid @RequestBody IngredientUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Ingredient updated successfully.",
                adminIngredientService.update(ingredientId, request)));
    }

    @PutMapping("/{ingredientId}/status")
    public ResponseEntity<ApiResponse<AdminIngredientResponse>> setStatus(
            @PathVariable Integer ingredientId,
            @Valid @RequestBody IngredientStatusRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Ingredient status updated successfully.",
                adminIngredientService.setActive(ingredientId, request.getActive())));
    }
}
