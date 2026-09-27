package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.DishOptionResponse;
import com.fpt.swp391.nutribot.service.WeeklyMenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class DishCatalogController {

    private final WeeklyMenuService weeklyMenuService;

    @GetMapping("/api/v1/dishes")
    public ResponseEntity<ApiResponse<List<DishOptionResponse>>> getDishCatalog() {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách món ăn thành công",
                weeklyMenuService.getDishCatalog()));
    }
}
