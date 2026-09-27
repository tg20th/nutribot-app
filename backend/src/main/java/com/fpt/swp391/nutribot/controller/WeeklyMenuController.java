package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.WeeklyMenuCreateRequest;
import com.fpt.swp391.nutribot.dto.request.WeeklyMenuAiSaveRequest;
import com.fpt.swp391.nutribot.dto.request.WeeklyMenuItemCreateRequest;
import com.fpt.swp391.nutribot.dto.request.WeeklyMenuUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.WeeklyMenuResponse;
import com.fpt.swp391.nutribot.service.WeeklyMenuService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/weekly-menus")
@RequiredArgsConstructor
public class WeeklyMenuController {

    private final WeeklyMenuService weeklyMenuService;

    @PostMapping
    public ResponseEntity<ApiResponse<WeeklyMenuResponse>> createWeeklyMenu(
            Principal principal,
            @Valid @RequestBody WeeklyMenuCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(
                "Tạo thực đơn tuần thành công",
                weeklyMenuService.createWeeklyMenu(principal.getName(), request)));
    }

    @PostMapping("/ai-generated")
    public ResponseEntity<ApiResponse<WeeklyMenuResponse>> saveAiGeneratedMenu(
            Principal principal,
            @Valid @RequestBody WeeklyMenuAiSaveRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu thực đơn AI thành công",
                weeklyMenuService.saveAiGeneratedMenu(principal.getName(), request)));
    }

    @GetMapping("/current")
    public ResponseEntity<ApiResponse<WeeklyMenuResponse>> getCurrentWeeklyMenu(
            Principal principal,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy thực đơn tuần thành công",
                weeklyMenuService.getCurrentWeeklyMenu(principal.getName(), startDate)));
    }

    @PostMapping("/{menuId}/items")
    public ResponseEntity<ApiResponse<WeeklyMenuResponse.ItemResponse>> addWeeklyMenuItem(
            Principal principal,
            @PathVariable Integer menuId,
            @Valid @RequestBody WeeklyMenuItemCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(
                "Thêm món vào thực đơn thành công",
                weeklyMenuService.addWeeklyMenuItem(principal.getName(), menuId, request)));
    }

    @PutMapping("/{menuId}")
    public ResponseEntity<ApiResponse<WeeklyMenuResponse>> updateWeeklyMenu(
            Principal principal,
            @PathVariable Integer menuId,
            @Valid @RequestBody WeeklyMenuUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật thực đơn tuần thành công",
                weeklyMenuService.updateWeeklyMenu(principal.getName(), menuId, request)));
    }

    @DeleteMapping("/{menuId}/items/{itemId}")
    public ResponseEntity<Void> deleteWeeklyMenuItem(
            Principal principal,
            @PathVariable Integer menuId,
            @PathVariable Integer itemId) {
        weeklyMenuService.deleteWeeklyMenuItem(principal.getName(), menuId, itemId);
        return ResponseEntity.noContent().build();
    }
}
