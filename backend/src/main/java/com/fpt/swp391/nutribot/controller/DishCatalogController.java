package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.DishDetailResponse;
import com.fpt.swp391.nutribot.dto.response.DishOptionResponse;
import com.fpt.swp391.nutribot.service.DishService;
import com.fpt.swp391.nutribot.service.WeeklyMenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/dishes")
public class DishCatalogController {

    private final WeeklyMenuService weeklyMenuService;
    private final DishService dishService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<DishOptionResponse>>> getDishCatalog() {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách món ăn thành công",
                weeklyMenuService.getDishCatalog()));
    }

    @GetMapping("/{dishId}")
    public ResponseEntity<ApiResponse<DishDetailResponse>> getDishDetail(
            @PathVariable Integer dishId,
            Authentication authentication) {
        // Authorized User - must be logged in
        if (authentication == null) {
            return ResponseEntity.status(401)
                    .body(ApiResponse.error("Vui lòng đăng nhập để xem chi tiết món ăn"));
        }
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết món ăn thành công",
                dishService.getDishDetail(dishId)));
    }
}
