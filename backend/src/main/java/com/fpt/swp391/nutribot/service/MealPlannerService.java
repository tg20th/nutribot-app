package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.request.MealPlanGenerateRequest;
import com.fpt.swp391.nutribot.dto.response.MealPlanGenerateResponse;
import com.fpt.swp391.nutribot.dto.response.MealPlanDishResponse;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.entity.Dish;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.entity.UserAllergy;
import com.fpt.swp391.nutribot.exception.AIServiceUnavailableException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.repository.DishRepository;
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
    private final DishRepository dishRepository;
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

        List<Dish> availableDishes = dishRepository.findAllByActiveTrueAndCaloriesIsNotNullOrderByNameAsc();
        if (availableDishes.isEmpty()) {
            throw new AIServiceUnavailableException("No active dishes with calories are available for AI planning.");
        }

        Set<String> exclusions = new LinkedHashSet<>();
        if (profile != null) {
            profile.getAllergies().stream().map(ua -> ua.getIngredient().getName()).forEach(exclusions::add);
        }
        if (request.getExcludedAllergies() != null) {
            request.getExcludedAllergies().stream().map(String::trim).filter(value -> !value.isBlank()).forEach(exclusions::add);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("targetCalories", request.getTargetCalories());
        payload.put("healthGoal", normaliseGoal(request.getHealthGoal()));
        payload.put("availableIngredients", distinctNames(request.getAvailableIngredients()));
        payload.put("excludedAllergies", List.copyOf(exclusions));
        payload.put("availableDishes", availableDishes.stream().map(this::toAiDishOption).toList());
        payload.put("bmi", calculateBmi(
                profile == null ? null : profile.getHeightCm(),
                profile == null ? null : profile.getWeightKg()));
        MealPlanGenerateResponse response = callAiService(payload);
        attachDishDetails(response, availableDishes);
        return response;
    }

    private Map<String, Object> toAiDishOption(Dish dish) {
        Map<String, Object> option = new LinkedHashMap<>();
        option.put("dishId", dish.getDishId());
        option.put("name", dish.getName());
        option.put("calories", dish.getCalories());
        option.put("proteinG", dish.getProteinG());
        return option;
    }

    private void attachDishDetails(MealPlanGenerateResponse response, List<Dish> availableDishes) {
        Map<Integer, Dish> dishesById = availableDishes.stream()
                .collect(java.util.stream.Collectors.toMap(Dish::getDishId, dish -> dish));
        if (response.getWeeklyPlan() == null || response.getWeeklyPlan().size() != 7) {
            throw new AIServiceUnavailableException("AI service returned an invalid seven-day plan.");
        }
        response.getWeeklyPlan().forEach(day -> {
            attachDishDetails(day.getBreakfast(), dishesById);
            attachDishDetails(day.getLunch(), dishesById);
            attachDishDetails(day.getDinner(), dishesById);
        });
    }

    private void attachDishDetails(MealPlanDishResponse selection, Map<Integer, Dish> dishesById) {
        if (selection == null || selection.getDishId() == null || selection.getServings() == null) {
            throw new AIServiceUnavailableException("AI service returned an invalid dish selection.");
        }
        Dish dish = dishesById.get(selection.getDishId());
        if (dish == null) {
            throw new AIServiceUnavailableException("AI selected a dish outside the active catalog.");
        }
        selection.setDishName(dish.getName());
        selection.setCalories(dish.getCalories());
        selection.setProteinG(dish.getProteinG());
        selection.setImageUrl(dish.getImageUrl());
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
                    .version(HttpClient.Version.HTTP_1_1)
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
