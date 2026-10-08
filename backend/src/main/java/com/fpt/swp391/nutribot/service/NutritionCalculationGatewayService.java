package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.request.NutritionCalculationRequest;
import com.fpt.swp391.nutribot.dto.response.NutritionCalculationResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Slf4j
@Service
public class NutritionCalculationGatewayService {

    private final RestClient aiClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public NutritionCalculationGatewayService(
            @Value("${ai-service.base-url:http://localhost:8000}") String aiServiceBaseUrl) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(20));

        this.aiClient = RestClient.builder()
                .baseUrl(aiServiceBaseUrl.replaceAll("/$", ""))
                .requestFactory(requestFactory)
                .build();
    }

    public NutritionCalculationResponse calculateNutrition(NutritionCalculationRequest request) {
        int servings = (request.getServings() != null && request.getServings() > 0) ? request.getServings() : 1;
        try {
            String requestBody = objectMapper.writeValueAsString(request);
            String responseStr = aiClient.post()
                    .uri("/api/ai/calculate-nutrition")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody.getBytes(StandardCharsets.UTF_8))
                    .retrieve()
                    .body(String.class);

            if (responseStr != null && !responseStr.isBlank()) {
                JsonNode root = objectMapper.readTree(responseStr);
                JsonNode data = root.has("data") ? root.get("data") : root;
                return NutritionCalculationResponse.builder()
                        .calories(data.path("calories").asInt(0))
                        .proteinG(data.path("protein_g").asDouble(0.0))
                        .carbsG(data.path("carbs_g").asDouble(0.0))
                        .fatG(data.path("fat_g").asDouble(0.0))
                        .fiberG(data.path("fiber_g").asDouble(0.0))
                        .sodiumMg(data.path("sodium_mg").asDouble(0.0))
                        .totalCalories(data.path("total_calories").asInt(0))
                        .summary(data.path("summary").asText(""))
                        .build();
            }
        } catch (Exception ex) {
            log.warn("Lỗi gọi AI calculate-nutrition ({}). Sử dụng tính toán dự phòng", ex.getMessage());
        }

        // Fallback calculation
        return calculateFallback(request, servings);
    }

    private NutritionCalculationResponse calculateFallback(NutritionCalculationRequest request, int servings) {
        double totalCal = 0.0;
        double totalPro = 0.0;
        double totalCarbs = 0.0;
        double totalFat = 0.0;
        double totalFiber = 0.0;
        double totalSodium = 0.0;

        if (request.getIngredients() != null) {
            for (NutritionCalculationRequest.IngredientItem item : request.getIngredients()) {
                double qty = item.getQuantity() != null ? item.getQuantity() : 100.0;
                String unit = item.getUnit() != null ? item.getUnit().toLowerCase() : "g";
                double grams = switch (unit) {
                    case "kg" -> qty * 1000;
                    case "tbsp", "muỗng canh" -> qty * 15;
                    case "tsp", "muỗng cà phê" -> qty * 5;
                    case "quả", "trái" -> qty * 50;
                    default -> qty;
                };
                double factor = grams / 100.0;
                String name = item.getName() != null ? item.getName().toLowerCase() : "";

                // default 100g estimate
                double cal100 = 80.0, pro100 = 4.0, carbs100 = 10.0, fat100 = 2.0, fib100 = 2.0, sod100 = 20.0;
                if (name.contains("đậu phụ") || name.contains("tofu")) {
                    cal100 = 76.0; pro100 = 8.0; carbs100 = 1.9; fat100 = 4.8; fib100 = 0.3; sod100 = 7.0;
                } else if (name.contains("nấm")) {
                    cal100 = 25.0; pro100 = 3.0; carbs100 = 3.5; fat100 = 0.3; fib100 = 1.2; sod100 = 5.0;
                } else if (name.contains("dầu")) {
                    cal100 = 884.0; pro100 = 0.0; carbs100 = 0.0; fat100 = 100.0; fib100 = 0.0; sod100 = 1.0;
                } else if (name.contains("cơm") || name.contains("gạo")) {
                    cal100 = 130.0; pro100 = 2.7; carbs100 = 28.2; fat100 = 0.3; fib100 = 0.4; sod100 = 1.0;
                } else if (name.contains("trứng")) {
                    cal100 = 155.0; pro100 = 13.0; carbs100 = 1.1; fat100 = 11.0; fib100 = 0.0; sod100 = 124.0;
                }

                totalCal += cal100 * factor;
                totalPro += pro100 * factor;
                totalCarbs += carbs100 * factor;
                totalFat += fat100 * factor;
                totalFiber += fib100 * factor;
                totalSodium += sod100 * factor;
            }
        }

        int calPerServing = (int) Math.round(totalCal / servings);
        return NutritionCalculationResponse.builder()
                .calories(calPerServing)
                .proteinG(Math.round((totalPro / servings) * 10.0) / 10.0)
                .carbsG(Math.round((totalCarbs / servings) * 10.0) / 10.0)
                .fatG(Math.round((totalFat / servings) * 10.0) / 10.0)
                .fiberG(Math.round((totalFiber / servings) * 10.0) / 10.0)
                .sodiumMg(Math.round(totalSodium / servings * 10.0) / 10.0)
                .totalCalories((int) Math.round(totalCal))
                .summary("Ước tính dinh dưỡng công thức nấu ăn.")
                .build();
    }
}
