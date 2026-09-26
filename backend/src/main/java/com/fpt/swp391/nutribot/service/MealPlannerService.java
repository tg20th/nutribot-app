package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.request.MealPlanGenerateRequest;
import com.fpt.swp391.nutribot.dto.response.MealPlanGenerateResponse;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.exception.AIServiceUnavailableException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class MealPlannerService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final ObjectMapper objectMapper;

    @Value("${ai-service.base-url:http://localhost:8000}")
    private String aiServiceBaseUrl;

    @Value("${ai-service.timeout-seconds:35}")
    private long aiServiceTimeoutSeconds;

    @Transactional(readOnly = true)
    public MealPlanGenerateResponse generate(String username, MealPlanGenerateRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        UserProfile profile = userProfileRepository.findById(user.getUserId()).orElse(null);

        Set<String> exclusions = new LinkedHashSet<>();
        if (profile != null) {
            profile.getAllergies().stream().map(Ingredient::getName).forEach(exclusions::add);
        }
        if (request.getExcludedAllergies() != null) {
            request.getExcludedAllergies().stream().map(String::trim).filter(value -> !value.isBlank()).forEach(exclusions::add);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("targetCalories", request.getTargetCalories());
        payload.put("healthGoal", normaliseGoal(request.getHealthGoal()));
        payload.put("availableIngredients", distinctNames(request.getAvailableIngredients()));
        payload.put("excludedAllergies", List.copyOf(exclusions));
        payload.put("bmi", calculateBmi(
                profile == null ? null : profile.getHeightCm(),
                profile == null ? null : profile.getWeightKg()));
        return callAiService(payload);
    }

    private MealPlanGenerateResponse callAiService(Map<String, Object> payload) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiServiceBaseUrl + "/api/ai/generate-meal-plan"))
                    .timeout(Duration.ofSeconds(aiServiceTimeoutSeconds))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(aiServiceTimeoutSeconds))
                    .build()
                    .send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AIServiceUnavailableException("Dịch vụ AI hiện không thể tạo thực đơn, vui lòng thử lại sau");
            }
            MealPlanGenerateResponse result = objectMapper.readValue(response.body(), MealPlanGenerateResponse.class);
            if (result.getWeeklyPlan() == null || result.getWeeklyPlan().size() != 7) {
                throw new AIServiceUnavailableException("Dịch vụ AI trả về thực đơn không hợp lệ, vui lòng thử lại");
            }
            return result;
        } catch (JsonProcessingException exception) {
            throw new AIServiceUnavailableException("Không thể chuẩn bị yêu cầu tạo thực đơn AI");
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new AIServiceUnavailableException("Dịch vụ AI hiện không thể tạo thực đơn, vui lòng thử lại sau");
        }
    }

    private List<String> distinctNames(List<String> values) {
        return values.stream().map(String::trim).filter(value -> !value.isBlank()).distinct().toList();
    }

    private String normaliseGoal(String healthGoal) {
        return "maintain".equals(healthGoal) ? "maintain_weight" : healthGoal;
    }

    private BigDecimal calculateBmi(BigDecimal heightCm, BigDecimal weightKg) {
        if (heightCm == null || weightKg == null || heightCm.signum() <= 0 || weightKg.signum() <= 0) return null;
        BigDecimal heightMeters = heightCm.movePointLeft(2);
        return weightKg.divide(heightMeters.multiply(heightMeters), 1, RoundingMode.HALF_UP);
    }
}
