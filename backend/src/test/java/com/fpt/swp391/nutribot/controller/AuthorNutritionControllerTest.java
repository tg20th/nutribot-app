package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.NutritionCalculationRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.NutritionCalculationResponse;
import com.fpt.swp391.nutribot.service.NutritionCalculationGatewayService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử AuthorNutritionController")
class AuthorNutritionControllerTest {

    @Mock
    private NutritionCalculationGatewayService nutritionCalculationGatewayService;

    @InjectMocks
    private AuthorNutritionController authorNutritionController;

    @Test
    @DisplayName("Tính toán dinh dưỡng thành công trả về HTTP 200")
    void calculate_success() {
        NutritionCalculationRequest req = NutritionCalculationRequest.builder()
                .servings(2)
                .dishName("Salad")
                .ingredients(List.of(
                        new NutritionCalculationRequest.IngredientItem("Đậu phụ", 200.0, "g")
                ))
                .build();

        NutritionCalculationResponse expected = NutritionCalculationResponse.builder()
                .calories(150)
                .proteinG(16.0)
                .carbsG(4.0)
                .fatG(9.6)
                .build();

        when(nutritionCalculationGatewayService.calculateNutrition(any())).thenReturn(expected);

        ResponseEntity<ApiResponse<NutritionCalculationResponse>> response = authorNutritionController.calculate(req);

        assertNotNull(response.getBody());
        assertTrue(response.getBody().isSuccess());
        assertEquals(150, response.getBody().getData().getCalories());
        assertEquals(16.0, response.getBody().getData().getProteinG());
    }
}
