package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.request.MealPlanGenerateRequest;
import com.fpt.swp391.nutribot.dto.response.MealPlanGenerateResponse;
import com.fpt.swp391.nutribot.dto.response.MealPlanDayResponse;
import com.fpt.swp391.nutribot.dto.response.MealPlanDishResponse;
import com.fpt.swp391.nutribot.dto.response.NutritionTargetResponse;
import com.fpt.swp391.nutribot.entity.Dish;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.entity.Recipe;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.entity.UserAllergy;
import com.fpt.swp391.nutribot.exception.AIServiceUnavailableException;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.DishRepository;
import com.fpt.swp391.nutribot.repository.IngredientRepository;
import com.fpt.swp391.nutribot.repository.RecipeIngredientRepository;
import com.fpt.swp391.nutribot.repository.RecipeRepository;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class MealPlannerService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final DishRepository dishRepository;
    private final RecipeRepository recipeRepository;
    private final RecipeIngredientRepository recipeIngredientRepository;
    private final IngredientRepository ingredientRepository;
    private final NutritionTargetService nutritionTargetService;
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

        // Lấy dishes có đầy đủ nutrition (protein, carbs, fats)
        List<Dish> availableDishes = dishRepository
                .findAllByActiveTrueAndCaloriesIsNotNullAndProteinGIsNotNullOrderByNameAsc();
        if (availableDishes.isEmpty()) {
            throw new AIServiceUnavailableException("No active dishes with complete nutrition are available.");
        }

        // === Allergy: names → ingredient IDs ===
        Set<Integer> allergyIngredientIds = new LinkedHashSet<>();
        if (profile != null && profile.getAllergies() != null) {
            for (UserAllergy ua : profile.getAllergies()) {
                if (ua.getIngredient() != null && ua.getIngredient().getIngredientId() != null) {
                    allergyIngredientIds.add(ua.getIngredient().getIngredientId());
                }
            }
        }
        // Thêm từ request exclusions (names)
        if (request.getExcludedAllergies() != null) {
            for (String allergyName : request.getExcludedAllergies()) {
                if (allergyName != null && !allergyName.isBlank()) {
                    ingredientRepository.findByNameIgnoreCase(allergyName.trim())
                            .ifPresent(ing -> allergyIngredientIds.add(ing.getIngredientId()));
                }
            }
        }

        // === Vegetarian type ===
        String vegetarianType = normaliseVegetarianType(
                request.getVegetarianType() != null ? request.getVegetarianType() :
                        (profile != null ? profile.getVegetarianType() : null)
        );
        if (vegetarianType == null) {
            vegetarianType = "LACTO_OVO"; // default
        }

        // === Nutrition target ===
        NutritionTarget nutritionTarget = resolveNutritionTarget(username, request);

        // === Build canonical dishes với ingredient IDs ===
        Map<Integer, List<Integer>> dishIngredientIds = buildDishIngredientMap(availableDishes);
        List<Map<String, Object>> canonicalDishes = buildCanonicalDishes(availableDishes, dishIngredientIds);

        // === Build DeterministicPlannerRequest payload ===
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("vegetarianType", vegetarianType);
        payload.put("allergyIngredientIds", new ArrayList<>(allergyIngredientIds));

        // Nutrition target
        Map<String, Object> nutTarget = new LinkedHashMap<>();
        nutTarget.put("calories", nutritionTarget.calories);
        nutTarget.put("proteinG", nutritionTarget.proteinG);
        nutTarget.put("carbsG", nutritionTarget.carbsG);
        nutTarget.put("fatG", nutritionTarget.fatG);
        nutTarget.put("estimated", nutritionTarget.estimated);
        payload.put("nutritionTarget", nutTarget);

        payload.put("canonicalDishes", canonicalDishes);

        // === Gọi AI service ===
        MealPlanGenerateResponse response = callAiService(payload);

        // === Attach dish details (name, image, full nutrition) ===
        Map<Integer, Dish> dishesById = availableDishes.stream()
                .collect(java.util.stream.Collectors.toMap(Dish::getDishId, dish -> dish));
        attachDishDetails(response, dishesById);

        // === Set menu title, estimated daily calories & nutrition targets ===
        if (response.getSuggestedMenuTitle() == null || response.getSuggestedMenuTitle().isBlank()) {
            response.setSuggestedMenuTitle("Thực đơn tuần " + vegetarianType.toLowerCase().replace("_", "-"));
        }
        response.setEstimatedDailyCalories((int) Math.round(nutritionTarget.calories()));
        response.setNutritionTarget(NutritionTargetResponse.builder()
                .estimated(nutritionTarget.estimated())
                .calories((int) Math.round(nutritionTarget.calories()))
                .proteinG((int) Math.round(nutritionTarget.proteinG()))
                .carbsG((int) Math.round(nutritionTarget.carbsG()))
                .healthyFatsG((int) Math.round(nutritionTarget.fatG()))
                .build());

        return response;
    }

    private NutritionTarget resolveNutritionTarget(String username, MealPlanGenerateRequest request) {
        MealPlanGenerateRequest.NutritionTargetRequest nut = request.getNutritionTarget();
        if (nut != null && nut.getCalories() != null && nut.getProteinG() != null
                && nut.getCarbsG() != null && nut.getFatG() != null) {
            return new NutritionTarget(
                    nut.getCalories(),
                    nut.getProteinG(),
                    nut.getCarbsG(),
                    nut.getFatG(),
                    Boolean.TRUE.equals(nut.getEstimated())
            );
        }

        // Tính từ NutritionTargetService (ném ProfileIncompleteException nếu hồ sơ chưa đủ để Frontend hiển thị modal)
        NutritionTargetResponse serviceTarget = nutritionTargetService.calculateTarget(username);
        return new NutritionTarget(
                (double) serviceTarget.calories(),
                (double) serviceTarget.proteinG(),
                (double) serviceTarget.carbsG(),
                (double) serviceTarget.healthyFatsG(),
                true
        );
    }

    private Map<Integer, List<Integer>> buildDishIngredientMap(List<Dish> dishes) {
        Map<Integer, List<Integer>> result = new LinkedHashMap<>();
        List<Integer> dishIds = dishes.stream().map(Dish::getDishId).toList();

        // Batch: dish_id → recipe → ingredients
        for (Dish dish : dishes) {
            result.put(dish.getDishId(), new ArrayList<>());
        }

        for (Dish dish : dishes) {
            Optional<Recipe> recipeOpt = recipeRepository.findByDishId(dish.getDishId());
            if (recipeOpt.isPresent()) {
                List<Integer> ingredientIds = recipeIngredientRepository
                        .findIngredientIdsByRecipeId(recipeOpt.get().getRecipeId());
                result.put(dish.getDishId(), ingredientIds);
            }
        }

        return result;
    }

    private List<Map<String, Object>> buildCanonicalDishes(
            List<Dish> dishes,
            Map<Integer, List<Integer>> dishIngredientIds) {

        // Batch fetch all ingredient names
        Set<Integer> allIngredientIds = new LinkedHashSet<>();
        for (List<Integer> ids : dishIngredientIds.values()) {
            allIngredientIds.addAll(ids);
        }
        Map<Integer, String> ingredientNames = new LinkedHashMap<>();
        if (!allIngredientIds.isEmpty()) {
            ingredientRepository.findAllById(allIngredientIds).forEach(ing ->
                    ingredientNames.put(ing.getIngredientId(), ing.getName()));
        }

        List<Map<String, Object>> canonicalDishes = new ArrayList<>();
        for (Dish dish : dishes) {
            Map<String, Object> dishMap = new LinkedHashMap<>();
            dishMap.put("dishId", dish.getDishId());
            dishMap.put("name", dish.getName());
            dishMap.put("description", dish.getDescription());
            dishMap.put("imageUrl", dish.getImageUrl());
            dishMap.put("categoryId", dish.getCategoryId());
            dishMap.put("servingSize", dish.getServingSize() != null ? dish.getServingSize().doubleValue() : 100.0);
            dishMap.put("servingUnit", dish.getServingUnit() != null ? dish.getServingUnit() : "g");
            dishMap.put("calories", dish.getCalories() != null ? dish.getCalories().doubleValue() : 0.0);
            dishMap.put("proteinG", dish.getProteinG() != null ? dish.getProteinG().doubleValue() : 0.0);
            dishMap.put("carbsG", dish.getCarbsG() != null ? dish.getCarbsG().doubleValue() : 0.0);
            dishMap.put("healthyFatsG", dish.getHealthyFatsG() != null ? dish.getHealthyFatsG().doubleValue() : 0.0);
            dishMap.put("vegetarianType", normaliseVegetarianType(dish.getVegetarianType()) != null
                    ? normaliseVegetarianType(dish.getVegetarianType()) : "LACTO_OVO");
            dishMap.put("isActive", dish.getActive() != null ? dish.getActive() : true);

            // Ingredients
            List<Integer> ingIds = dishIngredientIds.getOrDefault(dish.getDishId(), List.of());
            List<Map<String, Object>> ingredients = new ArrayList<>();
            for (Integer ingId : ingIds) {
                ingredients.add(Map.of(
                        "ingredientId", ingId,
                        "name", ingredientNames.getOrDefault(ingId, "")
                ));
            }
            // Đảm bảo tuân thủ Pydantic schema min_length=1
            if (ingredients.isEmpty()) {
                ingredients.add(Map.of(
                        "ingredientId", 1,
                        "name", dish.getName()
                ));
            }
            dishMap.put("ingredients", ingredients);

            canonicalDishes.add(dishMap);
        }

        return canonicalDishes;
    }

    private MealPlanGenerateResponse callAiService(Map<String, Object> payload) {
        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(aiServiceBaseUrl + "/api/ai/generate-meal-plan"))
                    .timeout(Duration.ofSeconds(aiServiceTimeoutSeconds))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();

            HttpResponse<String> httpResponse = HttpClient.newBuilder()
                    .version(HttpClient.Version.HTTP_1_1)
                    .connectTimeout(Duration.ofSeconds(aiServiceTimeoutSeconds))
                    .build()
                    .send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (httpResponse.statusCode() < 200 || httpResponse.statusCode() >= 300) {
                throw new AIServiceUnavailableException(
                        "AI service returned " + httpResponse.statusCode() + ": " + httpResponse.body());
            }

            JsonNode root = objectMapper.readTree(httpResponse.body());
            String status = root.path("status").asText();

            if ("INFEASIBLE".equalsIgnoreCase(status)) {
                JsonNode reasonCodes = root.path("reasonCodes");
                String reason = reasonCodes.isArray() && !reasonCodes.isEmpty() ? reasonCodes.get(0).asText() : "INFEASIBLE";
                String msg = switch (reason) {
                    case "NO_SAFE_CANDIDATES" -> "Không có món ăn phù hợp với chế độ ăn và danh sách dị ứng của bạn.";
                    case "INSUFFICIENT_DIVERSITY" -> "Chưa đủ số lượng món ăn đa dạng trong hệ thống để tạo thực đơn 7 ngày.";
                    case "NO_SAFE_WEEKLY_FEASIBLE_SOLUTION" -> "Không thể tạo thực đơn cân đối thỏa mãn mục tiêu calo và dinh dưỡng hiện tại. Vui lòng điều chỉnh mục tiêu sức khỏe.";
                    default -> "Không thể tìm thấy thực đơn phù hợp với mục tiêu dinh dưỡng hiện tại.";
                };
                throw new BadRequestException(msg);
            }

            if ("TIME_LIMIT_REACHED".equalsIgnoreCase(status)) {
                throw new AIServiceUnavailableException("Bộ giải thuật toán mất nhiều thời gian hơn dự kiến, vui lòng thử lại sau.");
            }

            if (!"OPTIMAL".equalsIgnoreCase(status) && !"FEASIBLE".equalsIgnoreCase(status)) {
                throw new AIServiceUnavailableException("Dịch vụ AI không thể tạo thực đơn hợp lệ (status: " + status + ")");
            }

            JsonNode daysNode = root.path("days");
            if (!daysNode.isArray() || daysNode.size() != 7) {
                throw new AIServiceUnavailableException("Dịch vụ AI trả về số ngày thực đơn không hợp lệ.");
            }

            MealPlanGenerateResponse response = new MealPlanGenerateResponse();
            List<MealPlanDayResponse> weeklyPlan = new ArrayList<>(7);

            for (JsonNode dayNode : daysNode) {
                MealPlanDayResponse dayResponse = new MealPlanDayResponse();
                dayResponse.setDay(dayNode.path("day").asText());

                JsonNode mealsNode = dayNode.path("meals");
                if (mealsNode.isArray()) {
                    for (JsonNode mealNode : mealsNode) {
                        String slot = mealNode.path("slot").asText();
                        int dishId = mealNode.path("dishId").asInt();
                        MealPlanDishResponse dishResponse = new MealPlanDishResponse();
                        dishResponse.setDishId(dishId);
                        dishResponse.setServings(BigDecimal.ONE);

                        if ("BREAKFAST".equalsIgnoreCase(slot)) {
                            dayResponse.setBreakfast(dishResponse);
                        } else if ("LUNCH".equalsIgnoreCase(slot)) {
                            dayResponse.setLunch(dishResponse);
                        } else if ("DINNER".equalsIgnoreCase(slot)) {
                            dayResponse.setDinner(dishResponse);
                        }
                    }
                }
                weeklyPlan.add(dayResponse);
            }

            response.setWeeklyPlan(weeklyPlan);
            return response;

        } catch (JsonProcessingException exception) {
            throw new AIServiceUnavailableException("Không thể chuẩn bị yêu cầu tạo thực đơn AI");
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new AIServiceUnavailableException("Dịch vụ AI hiện không thể tạo thực đơn, vui lòng thử lại sau");
        }
    }

    private void attachDishDetails(MealPlanGenerateResponse response, Map<Integer, Dish> dishesById) {
        if (response.getWeeklyPlan() == null || response.getWeeklyPlan().size() != 7) {
            throw new AIServiceUnavailableException("AI service trả về thực đơn không hợp lệ.");
        }
        for (MealPlanDayResponse day : response.getWeeklyPlan()) {
            attachDishDetails(day.getBreakfast(), dishesById);
            attachDishDetails(day.getLunch(), dishesById);
            attachDishDetails(day.getDinner(), dishesById);
        }
    }

    private void attachDishDetails(MealPlanDishResponse selection, Map<Integer, Dish> dishesById) {
        if (selection == null || selection.getDishId() == null) return;
        Dish dish = dishesById.get(selection.getDishId());
        if (dish == null) return;
        selection.setDishName(dish.getName());
        selection.setCalories(dish.getCalories());
        selection.setProteinG(dish.getProteinG());
        selection.setCarbsG(dish.getCarbsG());
        selection.setHealthyFatsG(dish.getHealthyFatsG());
        selection.setImageUrl(dish.getImageUrl());
        if (selection.getServings() == null) {
            selection.setServings(BigDecimal.ONE);
        }
    }

    private String normaliseVegetarianType(String type) {
        if (type == null || type.isBlank()) return null;
        String upper = type.toUpperCase().trim();
        return switch (upper) {
            case "VEGAN", "LACTO", "OVO", "LACTO_OVO" -> upper;
            case "VEGETARIAN", "SEMI_VEGETARIAN" -> "LACTO_OVO";
            case "PESCATARIAN", "PESCETARIAN" -> "LACTO_OVO";
            default -> null;
        };
    }

    private record NutritionTarget(double calories, double proteinG, double carbsG, double fatG, boolean estimated) {}
}
