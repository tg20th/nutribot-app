package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.WeeklyMenuCreateRequest;
import com.fpt.swp391.nutribot.dto.request.WeeklyMenuAiSaveRequest;
import com.fpt.swp391.nutribot.dto.request.WeeklyMenuItemCreateRequest;
import com.fpt.swp391.nutribot.dto.request.WeeklyMenuUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.WeeklyMenuResponse;
import com.fpt.swp391.nutribot.dto.response.DishOptionResponse;
import com.fpt.swp391.nutribot.dto.response.NutritionMetrics;
import com.fpt.swp391.nutribot.dto.response.NutritionTargetResponse;
import com.fpt.swp391.nutribot.dto.response.WeeklyNutritionSummary;
import com.fpt.swp391.nutribot.dto.response.MealPlanDayResponse;
import com.fpt.swp391.nutribot.dto.response.MealPlanDishResponse;
import com.fpt.swp391.nutribot.entity.DailyMenu;
import com.fpt.swp391.nutribot.entity.Dish;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.entity.WeeklyMenu;
import com.fpt.swp391.nutribot.entity.WeeklyMenuItem;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.DailyMenuRepository;
import com.fpt.swp391.nutribot.repository.DishRepository;
import com.fpt.swp391.nutribot.repository.RecipeIngredientRepository;
import com.fpt.swp391.nutribot.repository.RecipeRepository;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.repository.WeeklyMenuItemRepository;
import com.fpt.swp391.nutribot.repository.WeeklyMenuRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WeeklyMenuService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final WeeklyMenuRepository weeklyMenuRepository;
    private final DailyMenuRepository dailyMenuRepository;
    private final WeeklyMenuItemRepository weeklyMenuItemRepository;
    private final DishRepository dishRepository;
    private final RecipeRepository recipeRepository;
    private final RecipeIngredientRepository recipeIngredientRepository;
    private final NutritionTargetService nutritionTargetService;

    public record AddMealResult(WeeklyMenuResponse.ItemResponse item, List<String> warnings) {}

    @Transactional(readOnly = true)
    public List<DishOptionResponse> getDishCatalog() {
        return dishRepository.findAllByActiveTrueAndCaloriesIsNotNullAndProteinGIsNotNullOrderByNameAsc().stream()
                .map(dish -> DishOptionResponse.builder()
                        .dishId(dish.getDishId())
                        .name(dish.getName())
                        .calories(dish.getCalories())
                        .proteinG(dish.getProteinG())
                        .carbsG(dish.getCarbsG())
                        .healthyFatsG(dish.getHealthyFatsG())
                        .servingSize(dish.getServingSize())
                        .servingUnit(dish.getServingUnit())
                        .vegetarianType(dish.getVegetarianType())
                        .imageUrl(dish.getImageUrl())
                        .build())
                .toList();
    }

    @Transactional
    public WeeklyMenuResponse createWeeklyMenu(String username, WeeklyMenuCreateRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        if (!request.getEndDate().equals(request.getStartDate().plusDays(6))) {
            throw new BadRequestException("Ngày kết thúc phải cách ngày bắt đầu đúng 6 ngày");
        }

        WeeklyMenu menu = WeeklyMenu.builder()
                .user(user)
                .title(request.getTitle())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .targetCalories(request.getTargetCalories())
                .dietaryGoal(request.getDietaryGoal())
                .status("initialized")
                .build();
        menu = weeklyMenuRepository.save(menu);
        UserProfile profile = userProfileRepository.findById(user.getUserId()).orElse(null);
        return toWeeklyMenuResponse(menu, profile, username);
    }

    @Transactional
    public WeeklyMenuResponse saveAiGeneratedMenu(String username, WeeklyMenuAiSaveRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        LocalDate startDate = request.getStartDate();
        if (startDate == null || !startDate.getDayOfWeek().equals(DayOfWeek.MONDAY)) {
            throw new BadRequestException("Ngày bắt đầu tuần phải là Thứ Hai");
        }

        var generatedMenu = request.getGeneratedMenu();
        if (generatedMenu == null || generatedMenu.getWeeklyPlan() == null
                || generatedMenu.getWeeklyPlan().size() != 7) {
            throw new BadRequestException("Thực đơn phải có đúng 7 ngày");
        }
        if (generatedMenu.getSuggestedMenuTitle() == null
                || generatedMenu.getSuggestedMenuTitle().isBlank()
                || generatedMenu.getSuggestedMenuTitle().length() > 150) {
            throw new BadRequestException("Tên thực đơn không hợp lệ");
        }
        if (generatedMenu.getEstimatedDailyCalories() == null
                || generatedMenu.getEstimatedDailyCalories() <= 0) {
            throw new BadRequestException("Lượng calo mục tiêu phải lớn hơn 0");
        }
        if (request.getDietaryGoal() != null && request.getDietaryGoal().length() > 100) {
            throw new BadRequestException("Mục tiêu dinh dưỡng tối đa 100 ký tự");
        }

        List<MealPlanDishResponse> requestedDishes = new ArrayList<>(21);
        for (MealPlanDayResponse day : generatedMenu.getWeeklyPlan()) {
            if (day == null || day.getBreakfast() == null || day.getLunch() == null || day.getDinner() == null) {
                throw new BadRequestException("Mỗi ngày phải có đủ bữa sáng, trưa và tối");
            }
            requestedDishes.add(day.getBreakfast());
            requestedDishes.add(day.getLunch());
            requestedDishes.add(day.getDinner());
        }

        Set<Integer> dishIds = new HashSet<>();
        for (MealPlanDishResponse meal : requestedDishes) {
            if (meal.getDishId() == null || meal.getDishId() <= 0) {
                throw new BadRequestException("Mỗi bữa ăn phải tham chiếu một món ăn hợp lệ");
            }
            if (meal.getServings() == null || meal.getServings().signum() <= 0
                    || meal.getServings().stripTrailingZeros().scale() > 2
                    || meal.getServings().compareTo(new BigDecimal("99.99")) > 0) {
                throw new BadRequestException("Khẩu phần phải nằm trong khoảng 0.01 đến 99.99");
            }
            dishIds.add(meal.getDishId());
        }

        Map<Integer, Dish> dishesById = dishRepository.findAllByDishIdInAndActiveTrue(dishIds).stream()
                .filter(dish -> dish.getCalories() != null)
                .collect(Collectors.toMap(Dish::getDishId, Function.identity()));
        if (dishesById.size() != dishIds.size()) {
            throw new BadRequestException("Thực đơn chứa món không tồn tại, không hoạt động hoặc thiếu calo");
        }

        // --- NB-55: Trust boundary revalidation ---
        UserProfile profile = userProfileRepository.findById(user.getUserId()).orElse(null);
        String userVegetarianType = profile != null ? profile.getVegetarianType() : null;

        // 1. Validate vegetarian compatibility
        if (userVegetarianType != null) {
            for (Dish dish : dishesById.values()) {
                if (!isVegetarianCompatible(dish.getVegetarianType(), userVegetarianType)) {
                    throw new BadRequestException("Món '" + dish.getName()
                            + "' không tương thích với chế độ ăn " + userVegetarianType);
                }
            }
        }

        // 2. Validate allergy - re-query canonical ingredients via recipes
        if (profile != null && !profile.getAllergies().isEmpty()) {
            Set<Integer> userAllergyIngredientIds = profile.getAllergies().stream()
                    .map(a -> a.getIngredient().getIngredientId())
                    .collect(Collectors.toSet());

            for (Dish dish : dishesById.values()) {
                List<Integer> ingredientIds = recipeRepository.findByDishId(dish.getDishId())
                        .map(recipe -> recipeIngredientRepository.findIngredientIdsByRecipeId(recipe.getRecipeId()))
                        .orElse(List.of());

                List<String> conflictingIngredients = ingredientIds.stream()
                        .filter(userAllergyIngredientIds::contains)
                        .map(ingId -> {
                            for (var allergy : profile.getAllergies()) {
                                if (allergy.getIngredient().getIngredientId().equals(ingId)) {
                                    return allergy.getIngredient().getName();
                                }
                            }
                            return null;
                        })
                        .filter(name -> name != null)
                        .toList();

                if (!conflictingIngredients.isEmpty()) {
                    throw new BadRequestException("Món '" + dish.getName()
                            + "' chứa nguyên liệu dị ứng: " + String.join(", ", conflictingIngredients));
                }
            }
        }

        WeeklyMenu menu = weeklyMenuRepository
                .findFirstByUserUserIdAndStartDateOrderByUpdatedAtDesc(user.getUserId(), startDate)
                .orElseGet(() -> WeeklyMenu.builder().user(user).startDate(startDate).endDate(startDate.plusDays(6)).build());

        List<DailyMenu> oldMeals = menu.getMenuId() == null ? List.of()
                : dailyMenuRepository.findByWeeklyMenuMenuIdOrderByDayOfWeekAscMealTypeAsc(menu.getMenuId());
        if (!oldMeals.isEmpty()) {
            dailyMenuRepository.deleteAll(oldMeals);
            dailyMenuRepository.flush();
        }

        menu.setTitle(generatedMenu.getSuggestedMenuTitle().trim());
        menu.setStartDate(startDate);
        menu.setEndDate(startDate.plusDays(6));
        menu.setTargetCalories(generatedMenu.getEstimatedDailyCalories());
        menu.setDietaryGoal(request.getDietaryGoal());
        menu.setStatus("saved");
        menu = weeklyMenuRepository.save(menu);

        List<MealPlanDishResponse> mealsInOrder = new ArrayList<>(requestedDishes);
        String[] mealTypes = {"breakfast", "lunch", "dinner"};
        for (int dayIndex = 0; dayIndex < 7; dayIndex++) {
            for (int mealIndex = 0; mealIndex < mealTypes.length; mealIndex++) {
                MealPlanDishResponse selected = mealsInOrder.get(dayIndex * 3 + mealIndex);
                DailyMenu dailyMenu = dailyMenuRepository.save(DailyMenu.builder()
                        .weeklyMenu(menu)
                        .dayOfWeek(dayIndex + 1)
                        .mealType(mealTypes[mealIndex])
                        .build());
                weeklyMenuItemRepository.save(WeeklyMenuItem.builder()
                        .dailyMenu(dailyMenu)
                        .dish(dishesById.get(selected.getDishId()))
                        .servings(selected.getServings().setScale(2, RoundingMode.UNNECESSARY))
                        .notes("Suggested by NutriBot AI")
                        .build());
            }
        }
        return toWeeklyMenuResponse(menu, profile, username);
    }

    @Transactional
    public WeeklyMenuResponse updateWeeklyMenu(String username, Integer menuId, WeeklyMenuUpdateRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        WeeklyMenu menu = weeklyMenuRepository.findByMenuIdAndUserUserId(menuId, user.getUserId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thực đơn tuần"));
        if (!request.getEndDate().equals(request.getStartDate().plusDays(6))) {
            throw new BadRequestException("Ngày kết thúc phải cách ngày bắt đầu đúng 6 ngày");
        }

        List<WeeklyMenuItemCreateRequest> requestedItems = request.getMeals();
        Set<Integer> dishIds = requestedItems.stream()
                .map(WeeklyMenuItemCreateRequest::getDishId)
                .collect(Collectors.toSet());
        Map<Integer, Dish> dishesById = dishRepository.findAllByDishIdInAndActiveTrue(dishIds).stream()
                .collect(Collectors.toMap(Dish::getDishId, Function.identity()));
        if (dishesById.size() != dishIds.size()) {
            throw new BadRequestException("Danh sách món ăn có món không tồn tại hoặc không hoạt động");
        }

        Set<String> slotDishKeys = new HashSet<>();
        Map<String, String> normalizedMealTypes = new HashMap<>();
        for (WeeklyMenuItemCreateRequest item : requestedItems) {
            String mealType = item.getMealType().trim().toLowerCase(Locale.ROOT);
            if (!List.of("breakfast", "lunch", "dinner", "snack").contains(mealType)) {
                throw new BadRequestException("Loại bữa ăn không hợp lệ");
            }
            if (dishesById.get(item.getDishId()).getCalories() == null) {
                throw new BadRequestException("Không thể lưu món ăn chưa có dữ liệu calo");
            }
            String slotKey = item.getDayOfWeek() + ":" + mealType;
            if (!slotDishKeys.add(slotKey + ":" + item.getDishId())) {
                throw new BadRequestException("Món ăn đã có trong bữa này: " + slotKey);
            }
            normalizedMealTypes.put(slotKey, mealType);
        }

        List<DailyMenu> oldMeals = dailyMenuRepository
                .findByWeeklyMenuMenuIdOrderByDayOfWeekAscMealTypeAsc(menu.getMenuId());
        dailyMenuRepository.deleteAll(oldMeals);
        dailyMenuRepository.flush();

        menu.setTitle(request.getTitle());
        menu.setStartDate(request.getStartDate());
        menu.setEndDate(request.getEndDate());
        menu.setTargetCalories(request.getTargetCalories());
        menu.setDietaryGoal(request.getDietaryGoal());
        menu.setStatus("saved");
        weeklyMenuRepository.save(menu);

        Map<String, DailyMenu> mealsBySlot = new HashMap<>();
        for (WeeklyMenuItemCreateRequest item : requestedItems) {
            String mealType = normalizedMealTypes.get(item.getDayOfWeek() + ":"
                    + item.getMealType().trim().toLowerCase(Locale.ROOT));
            String slotKey = item.getDayOfWeek() + ":" + mealType;
            DailyMenu dailyMenu = mealsBySlot.computeIfAbsent(slotKey, ignored ->
                    dailyMenuRepository.save(DailyMenu.builder()
                            .weeklyMenu(menu)
                            .dayOfWeek(item.getDayOfWeek())
                            .mealType(mealType)
                            .build()));
            weeklyMenuItemRepository.save(WeeklyMenuItem.builder()
                    .dailyMenu(dailyMenu)
                    .dish(dishesById.get(item.getDishId()))
                    .servings(item.getServings())
                    .notes(item.getNotes())
                    .build());
        }
        UserProfile profile = userProfileRepository.findById(user.getUserId()).orElse(null);
        return toWeeklyMenuResponse(menu, profile, username);
    }

    @Transactional
    public AddMealResult addWeeklyMenuItem(
            String username,
            Integer menuId,
            WeeklyMenuItemCreateRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        WeeklyMenu menu = weeklyMenuRepository.findByMenuIdAndUserUserId(menuId, user.getUserId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thực đơn tuần"));
        String mealType = request.getMealType().trim().toLowerCase(Locale.ROOT);
        if (!List.of("breakfast", "lunch", "dinner", "snack").contains(mealType)) {
            throw new BadRequestException("Loại bữa ăn không hợp lệ");
        }

        Dish dish = dishRepository.findByDishIdAndActiveTrue(request.getDishId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy món ăn đang hoạt động"));
        if (dish.getCalories() == null) {
            throw new BadRequestException("Không thể thêm món ăn chưa có dữ liệu calo");
        }

        DailyMenu meal = dailyMenuRepository
                .findByWeeklyMenuMenuIdAndDayOfWeekAndMealType(menu.getMenuId(), request.getDayOfWeek(), mealType)
                .orElseGet(() -> dailyMenuRepository.save(DailyMenu.builder()
                        .weeklyMenu(menu)
                        .dayOfWeek(request.getDayOfWeek())
                        .mealType(mealType)
                        .build()));
        if (weeklyMenuItemRepository.existsByDailyMenuMealIdAndDishDishId(meal.getMealId(), dish.getDishId())) {
            throw new BadRequestException("Món ăn đã có trong bữa này");
        }

        WeeklyMenuItem item = weeklyMenuItemRepository.save(WeeklyMenuItem.builder()
                .dailyMenu(meal)
                .dish(dish)
                .servings(request.getServings())
                .notes(request.getNotes())
                .build());

        List<String> warnings = buildDayWarnings(username, menu, request.getDayOfWeek(), item);
        return new AddMealResult(toItemResponse(item, new long[7]), warnings);
    }

    @Transactional
    public void deleteWeeklyMenuItem(String username, Integer menuId, Integer itemId) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        weeklyMenuRepository.findByMenuIdAndUserUserId(menuId, user.getUserId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thực đơn tuần"));
        WeeklyMenuItem item = weeklyMenuItemRepository.findById(itemId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy món trong thực đơn"));
        if (!item.getDailyMenu().getWeeklyMenu().getMenuId().equals(menuId)) {
            throw new NotFoundException("Không tìm thấy món trong thực đơn");
        }
        weeklyMenuItemRepository.delete(item);
    }

    @Transactional(readOnly = true)
    public WeeklyMenuResponse getCurrentWeeklyMenu(String username, LocalDate requestedStartDate) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        LocalDate startDate = requestedStartDate == null ? currentWeekStart() : requestedStartDate;
        WeeklyMenu menu = weeklyMenuRepository
                .findFirstByUserUserIdAndStartDateOrderByUpdatedAtDesc(user.getUserId(), startDate)
                .orElse(null);

        UserProfile profile = userProfileRepository.findById(user.getUserId()).orElse(null);

        if (menu == null) {
            return emptyMenu(startDate, profile, username);
        }

        return toWeeklyMenuResponse(menu, profile, username);
    }

    private WeeklyMenuResponse toWeeklyMenuResponse(WeeklyMenu menu, UserProfile profile, String username) {
        List<DailyMenu> dailyMenus = dailyMenuRepository
                .findByWeeklyMenuMenuIdOrderByDayOfWeekAscMealTypeAsc(menu.getMenuId());
        Map<Integer, List<WeeklyMenuItem>> itemsByMeal = new HashMap<>();
        if (!dailyMenus.isEmpty()) {
            List<Integer> mealIds = dailyMenus.stream().map(DailyMenu::getMealId).toList();
            weeklyMenuItemRepository.findByDailyMenu_MealIdIn(mealIds).stream()
                    .sorted(Comparator.comparing(item -> item.getDish().getName(), String.CASE_INSENSITIVE_ORDER))
                    .forEach(item -> itemsByMeal
                            .computeIfAbsent(item.getDailyMenu().getMealId(), ignored -> new ArrayList<>())
                            .add(item));
        }

        Map<Integer, List<String>> dayWarnings = buildDayWarnings(username, dailyMenus, itemsByMeal);

        long[] dailyTotals = new long[7];
        List<WeeklyMenuResponse.MealResponse> meals = dailyMenus.stream().map(meal -> {
            List<WeeklyMenuItem> mealItems = itemsByMeal.getOrDefault(meal.getMealId(), List.of());
            List<WeeklyMenuResponse.ItemResponse> items = mealItems.stream()
                    .map(item -> toItemResponse(item, dailyTotals))
                    .toList();
            return WeeklyMenuResponse.MealResponse.builder()
                    .mealId(meal.getMealId())
                    .dayOfWeek(meal.getDayOfWeek())
                    .mealType(meal.getMealType())
                    .items(items)
                    .overTargetNutrients(dayWarnings.getOrDefault(meal.getDayOfWeek(), List.of()))
                    .build();
        }).toList();

        List<WeeklyMenuResponse.DailyCaloriesResponse> dailyCalories = new ArrayList<>(7);
        long weeklyTotal = 0;
        for (int day = 1; day <= 7; day++) {
            long total = dailyTotals[day - 1];
            weeklyTotal += total;
            dailyCalories.add(WeeklyMenuResponse.DailyCaloriesResponse.builder()
                    .dayOfWeek(day)
                    .totalCalories(total)
                    .build());
        }

        WeeklyNutritionSummary nutritionSummary = buildNutritionSummary(dailyMenus, itemsByMeal, menu, username);

        return WeeklyMenuResponse.builder()
                .menuId(menu.getMenuId())
                .startDate(menu.getStartDate())
                .endDate(menu.getEndDate())
                .targetCalories(menu.getTargetCalories())
                .status(menu.getStatus())
                .meals(meals)
                .dailyTotals(dailyCalories)
                .totalCalories(weeklyTotal)
                .nutritionSummary(nutritionSummary)
                .build();
    }

    private WeeklyNutritionSummary buildNutritionSummary(
            List<DailyMenu> dailyMenus,
            Map<Integer, List<WeeklyMenuItem>> itemsByMeal,
            WeeklyMenu menu,
            String username) {

        List<String> profileMissingFields = (username != null)
                ? nutritionTargetService.getMissingFields(username)
                : List.of();

        long weeklyCalories = 0L;
        BigDecimal weeklyProteinG = BigDecimal.ZERO;
        boolean hasProtein = false;
        BigDecimal weeklyCarbsG = BigDecimal.ZERO;
        boolean hasCarbs = false;
        BigDecimal weeklyFatsG = BigDecimal.ZERO;
        boolean hasFats = false;

        for (DailyMenu meal : dailyMenus) {
            List<WeeklyMenuItem> items = itemsByMeal.getOrDefault(meal.getMealId(), List.of());
            for (WeeklyMenuItem item : items) {
                BigDecimal servings = item.getServings() == null ? BigDecimal.ONE : item.getServings();

                Integer cal = item.getDish().getCalories();
                if (cal != null) {
                    weeklyCalories += Math.round((long) cal * servings.doubleValue());
                }

                BigDecimal protein = item.getDish().getProteinG();
                if (protein != null) {
                    weeklyProteinG = weeklyProteinG.add(protein.multiply(servings));
                    hasProtein = true;
                }

                BigDecimal carbs = item.getDish().getCarbsG();
                if (carbs != null) {
                    weeklyCarbsG = weeklyCarbsG.add(carbs.multiply(servings));
                    hasCarbs = true;
                }

                BigDecimal fats = item.getDish().getHealthyFatsG();
                if (fats != null) {
                    weeklyFatsG = weeklyFatsG.add(fats.multiply(servings));
                    hasFats = true;
                }
            }
        }

        NutritionMetrics actual = NutritionMetrics.builder()
                .calories(weeklyCalories)
                .proteinG(hasProtein ? weeklyProteinG.setScale(1, RoundingMode.HALF_UP) : null)
                .carbsG(hasCarbs ? weeklyCarbsG.setScale(1, RoundingMode.HALF_UP) : null)
                .healthyFatsG(hasFats ? weeklyFatsG.setScale(1, RoundingMode.HALF_UP) : null)
                .build();

        // Status based on dishes
        String status;
        List<String> missingFields;
        if (weeklyCalories == 0) {
            status = "EMPTY_MENU";
            missingFields = List.of("No meals in menu");
        } else if (hasProtein && hasCarbs && hasFats) {
            status = "AVAILABLE";
            missingFields = List.of();
        } else {
            status = "PARTIAL";
            List<String> m = new ArrayList<>();
            if (!hasProtein) m.add("proteinG");
            if (!hasCarbs) m.add("carbsG");
            if (!hasFats) m.add("healthyFatsG");
            missingFields = m;
        }

        // Target + Percentage from NutritionTargetService (NB-10).
        // Actuals are weekly totals, so targets are scaled to a week (x7) for
        // every metric — otherwise percentages would be ~700% for macros.
        NutritionMetrics target = null;
        NutritionMetrics percentage = null;

        if (profileMissingFields.isEmpty() && username != null) {
            NutritionTargetResponse nutTarget = nutritionTargetService.calculateTarget(username);
            long weeklyTargetCal = (long) nutTarget.calories() * 7L;
            long weeklyTargetProteinG = (long) nutTarget.proteinG() * 7L;
            long weeklyTargetCarbsG = (long) nutTarget.carbsG() * 7L;
            long weeklyTargetHealthyFatsG = (long) nutTarget.healthyFatsG() * 7L;
            target = NutritionMetrics.builder()
                    .calories(weeklyTargetCal)
                    .proteinG(BigDecimal.valueOf(weeklyTargetProteinG))
                    .carbsG(BigDecimal.valueOf(weeklyTargetCarbsG))
                    .healthyFatsG(BigDecimal.valueOf(weeklyTargetHealthyFatsG))
                    .build();

            if (weeklyCalories > 0 && weeklyTargetCal > 0) {
                Long pctCal = Math.round(weeklyCalories * 100.0 / weeklyTargetCal);
                BigDecimal pctProtein = hasProtein && weeklyTargetProteinG > 0
                        ? BigDecimal.valueOf(weeklyProteinG.doubleValue() * 100.0 / weeklyTargetProteinG).setScale(1, RoundingMode.HALF_UP) : null;
                BigDecimal pctCarbs = hasCarbs && weeklyTargetCarbsG > 0
                        ? BigDecimal.valueOf(weeklyCarbsG.doubleValue() * 100.0 / weeklyTargetCarbsG).setScale(1, RoundingMode.HALF_UP) : null;
                BigDecimal pctFats = hasFats && weeklyTargetHealthyFatsG > 0
                        ? BigDecimal.valueOf(weeklyFatsG.doubleValue() * 100.0 / weeklyTargetHealthyFatsG).setScale(1, RoundingMode.HALF_UP) : null;
                percentage = NutritionMetrics.builder()
                        .calories(pctCal)
                        .proteinG(pctProtein)
                        .carbsG(pctCarbs)
                        .healthyFatsG(pctFats)
                        .build();
            } else {
                percentage = NutritionMetrics.builder()
                        .calories(null)
                        .proteinG(null)
                        .carbsG(null)
                        .healthyFatsG(null)
                        .build();
            }
        }

        // PROFILE_INCOMPLETE overrides dish-based status
        List<String> allMissing = new ArrayList<>(missingFields);
        if (!profileMissingFields.isEmpty()) {
            status = "PROFILE_INCOMPLETE";
            allMissing.addAll(profileMissingFields);
        }

        return WeeklyNutritionSummary.builder()
                .status(status)
                .actual(actual)
                .target(target)
                .percentage(percentage)
                .missingFields(allMissing.isEmpty() ? List.of() : allMissing)
                .build();
    }

    private WeeklyMenuResponse.ItemResponse toItemResponse(WeeklyMenuItem item, long[] dailyTotals) {
        BigDecimal servings = item.getServings() == null ? BigDecimal.ONE : item.getServings();
        Integer baseCalories = item.getDish().getCalories();
        Integer totalCalories = baseCalories == null ? null : BigDecimal.valueOf(baseCalories)
                .multiply(servings)
                .setScale(0, RoundingMode.HALF_UP)
                .intValue();
        int dayIndex = item.getDailyMenu().getDayOfWeek() - 1;
        if (totalCalories != null && dayIndex >= 0 && dayIndex < dailyTotals.length) {
            dailyTotals[dayIndex] += totalCalories;
        }

        BigDecimal carbsG = item.getDish().getCarbsG();
        BigDecimal healthyFatsG = item.getDish().getHealthyFatsG();

        BigDecimal totalCarbsG = (carbsG != null)
                ? carbsG.multiply(servings).setScale(1, RoundingMode.HALF_UP)
                : null;
        BigDecimal totalHealthyFatsG = (healthyFatsG != null)
                ? healthyFatsG.multiply(servings).setScale(1, RoundingMode.HALF_UP)
                : null;

        return WeeklyMenuResponse.ItemResponse.builder()
                .itemId(item.getItemId())
                .dishId(item.getDish().getDishId())
                .dishName(item.getDish().getName())
                .calories(baseCalories)
                .proteinG(item.getDish().getProteinG())
                .carbsG(carbsG)
                .healthyFatsG(healthyFatsG)
                .imageUrl(item.getDish().getImageUrl())
                .servings(servings)
                .notes(item.getNotes())
                .totalCalories(totalCalories)
                .totalCarbsG(totalCarbsG)
                .totalHealthyFatsG(totalHealthyFatsG)
                .build();
    }

    private WeeklyMenuResponse emptyMenu(LocalDate startDate, UserProfile profile, String username) {
        List<WeeklyMenuResponse.DailyCaloriesResponse> dailyCalories = new ArrayList<>(7);
        for (int day = 1; day <= 7; day++) {
            dailyCalories.add(WeeklyMenuResponse.DailyCaloriesResponse.builder()
                    .dayOfWeek(day)
                    .totalCalories(0)
                    .build());
        }
        WeeklyNutritionSummary nutritionSummary = buildNutritionSummary(List.of(), Map.of(), null, username);
        return WeeklyMenuResponse.builder()
                .startDate(startDate)
                .endDate(startDate.plusDays(6))
                .meals(List.of())
                .dailyTotals(dailyCalories)
                .totalCalories(0)
                .nutritionSummary(nutritionSummary)
                .build();
    }

    private LocalDate currentWeekStart() {
        return LocalDate.now().with(DayOfWeek.MONDAY);
    }

    // NB-55: Vegetarian compatibility hierarchy
    // VEGAN strictest (VEGAN only) → LACTO → OVO → LACTO_OVO most flexible
    private boolean isVegetarianCompatible(String dishVegetarianType, String userVegetarianType) {
        if (dishVegetarianType == null || dishVegetarianType.isBlank()) {
            return false;
        }
        if (userVegetarianType == null || userVegetarianType.isBlank()) {
            return true;
        }
        String dish = dishVegetarianType.toUpperCase();
        String user = userVegetarianType.toUpperCase();
        if (user.equals("VEGAN")) return dish.equals("VEGAN");
        if (user.equals("LACTO")) return dish.equals("VEGAN") || dish.equals("LACTO");
        if (user.equals("OVO")) return dish.equals("VEGAN") || dish.equals("OVO");
        if (user.equals("LACTO_OVO")) return true; // accepts all
        return false;
    }

    private List<String> buildDayWarnings(String username, WeeklyMenu menu, Integer dayOfWeek, WeeklyMenuItem pendingItem) {
        List<WeeklyMenuItem> dayItems = new ArrayList<>();
        List<DailyMenu> dayMeals = dailyMenuRepository
                .findByWeeklyMenuMenuIdOrderByDayOfWeekAscMealTypeAsc(menu.getMenuId()).stream()
                .filter(meal -> meal.getDayOfWeek().equals(dayOfWeek))
                .toList();
        if (!dayMeals.isEmpty()) {
            dayItems.addAll(weeklyMenuItemRepository.findByDailyMenu_MealIdIn(
                    dayMeals.stream().map(DailyMenu::getMealId).toList()));
        }
        if (pendingItem != null && (pendingItem.getItemId() == null
                || dayItems.stream().noneMatch(item -> item.getItemId().equals(pendingItem.getItemId())))) {
            dayItems.add(pendingItem);
        }
        return buildDayWarnings(username, dayItems);
    }

    private Map<Integer, List<String>> buildDayWarnings(
            String username,
            List<DailyMenu> dailyMenus,
            Map<Integer, List<WeeklyMenuItem>> itemsByMeal) {
        Map<Integer, List<String>> warningsByDay = new HashMap<>();
        for (DailyMenu meal : dailyMenus) {
            int dayOfWeek = meal.getDayOfWeek();
            if (warningsByDay.containsKey(dayOfWeek)) continue;
            List<WeeklyMenuItem> dayItems = dailyMenus.stream()
                    .filter(dayMeal -> dayMeal.getDayOfWeek() == dayOfWeek)
                    .flatMap(dayMeal -> itemsByMeal.getOrDefault(dayMeal.getMealId(), List.of()).stream())
                    .toList();
            warningsByDay.put(dayOfWeek, buildDayWarnings(username, dayItems));
        }
        return warningsByDay;
    }

    private List<String> buildDayWarnings(String username, List<WeeklyMenuItem> dayItems) {
        List<String> warnings = new ArrayList<>();
        long dayCalories = 0;
        BigDecimal dayProtein = BigDecimal.ZERO;
        boolean hasProtein = false;

        for (WeeklyMenuItem item : dayItems) {
            BigDecimal servings = item.getServings() == null ? BigDecimal.ONE : item.getServings();
            Integer cal = item.getDish().getCalories();
            if (cal != null) dayCalories += Math.round((long) cal * servings.doubleValue());
            BigDecimal protein = item.getDish().getProteinG();
            if (protein != null) { dayProtein = dayProtein.add(protein.multiply(servings)); hasProtein = true; }
        }

        int dailyCalorieTarget = getDailyCalorieTarget(username);
        if (dayCalories > dailyCalorieTarget) {
            warnings.add("Tổng calo trong ngày vượt " + (dayCalories - dailyCalorieTarget)
                    + " kcal (target: " + dailyCalorieTarget + " kcal)");
        }

        int dailyProteinTarget = getDailyProteinTarget(username);
        if (hasProtein && dayProtein.doubleValue() > dailyProteinTarget) {
            warnings.add("Tổng protein trong ngày vượt " + Math.round(dayProtein.doubleValue() - dailyProteinTarget)
                    + "g (target: " + dailyProteinTarget + "g)");
        }

        return warnings;
    }

    private int getDailyCalorieTarget(String username) {
        try {
            List<String> missing = nutritionTargetService.getMissingFields(username);
            if (!missing.isEmpty()) return 2000;
            NutritionTargetResponse target = nutritionTargetService.calculateTarget(username);
            return target.calories();
        } catch (Exception e) {
            return 2000;
        }
    }

    private int getDailyProteinTarget(String username) {
        try {
            NutritionTargetResponse target = nutritionTargetService.calculateTarget(username);
            return target.proteinG();
        } catch (Exception e) {
            return 100;
        }
    }
}
