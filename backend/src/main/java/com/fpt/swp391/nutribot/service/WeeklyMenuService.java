package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.WeeklyMenuCreateRequest;
import com.fpt.swp391.nutribot.dto.request.WeeklyMenuAiSaveRequest;
import com.fpt.swp391.nutribot.dto.request.WeeklyMenuItemCreateRequest;
import com.fpt.swp391.nutribot.dto.request.WeeklyMenuUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.WeeklyMenuResponse;
import com.fpt.swp391.nutribot.dto.response.DishOptionResponse;
import com.fpt.swp391.nutribot.dto.response.MealPlanDayResponse;
import com.fpt.swp391.nutribot.dto.response.MealPlanDishResponse;
import com.fpt.swp391.nutribot.entity.DailyMenu;
import com.fpt.swp391.nutribot.entity.Dish;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.WeeklyMenu;
import com.fpt.swp391.nutribot.entity.WeeklyMenuItem;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.DailyMenuRepository;
import com.fpt.swp391.nutribot.repository.DishRepository;
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
    private final WeeklyMenuRepository weeklyMenuRepository;
    private final DailyMenuRepository dailyMenuRepository;
    private final WeeklyMenuItemRepository weeklyMenuItemRepository;
    private final DishRepository dishRepository;

    @Transactional(readOnly = true)
    public List<DishOptionResponse> getDishCatalog() {
        return dishRepository.findAllByActiveTrueAndCaloriesIsNotNullOrderByNameAsc().stream()
                .map(dish -> DishOptionResponse.builder()
                        .dishId(dish.getDishId())
                        .name(dish.getName())
                        .calories(dish.getCalories())
                        .proteinG(dish.getProteinG())
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
        return toWeeklyMenuResponse(menu);
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
        return toWeeklyMenuResponse(menu);
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

        Set<String> uniqueItems = new HashSet<>();
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
            String itemKey = slotKey + ":" + item.getDishId();
            if (!uniqueItems.add(itemKey)) {
                throw new BadRequestException("Món ăn bị lặp trong cùng một bữa");
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
        return toWeeklyMenuResponse(menu);
    }

    @Transactional
    public WeeklyMenuResponse.ItemResponse addWeeklyMenuItem(
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
        return toItemResponse(item, new long[7]);
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

        if (menu == null) {
            return emptyMenu(startDate);
        }

        return toWeeklyMenuResponse(menu);
    }

    private WeeklyMenuResponse toWeeklyMenuResponse(WeeklyMenu menu) {
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

        long[] dailyTotals = new long[7];
        List<WeeklyMenuResponse.MealResponse> meals = dailyMenus.stream().map(meal -> {
            List<WeeklyMenuResponse.ItemResponse> items = itemsByMeal
                    .getOrDefault(meal.getMealId(), List.of()).stream()
                    .map(item -> toItemResponse(item, dailyTotals))
                    .toList();
            return WeeklyMenuResponse.MealResponse.builder()
                    .mealId(meal.getMealId())
                    .dayOfWeek(meal.getDayOfWeek())
                    .mealType(meal.getMealType())
                    .items(items)
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

        return WeeklyMenuResponse.builder()
                .menuId(menu.getMenuId())
                .startDate(menu.getStartDate())
                .endDate(menu.getEndDate())
                .targetCalories(menu.getTargetCalories())
                .status(menu.getStatus())
                .meals(meals)
                .dailyTotals(dailyCalories)
                .totalCalories(weeklyTotal)
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

        return WeeklyMenuResponse.ItemResponse.builder()
                .itemId(item.getItemId())
                .dishId(item.getDish().getDishId())
                .dishName(item.getDish().getName())
                .calories(baseCalories)
                .proteinG(item.getDish().getProteinG())
                .imageUrl(item.getDish().getImageUrl())
                .servings(servings)
                .notes(item.getNotes())
                .totalCalories(totalCalories)
                .build();
    }

    private WeeklyMenuResponse emptyMenu(LocalDate startDate) {
        List<WeeklyMenuResponse.DailyCaloriesResponse> dailyCalories = new ArrayList<>(7);
        for (int day = 1; day <= 7; day++) {
            dailyCalories.add(WeeklyMenuResponse.DailyCaloriesResponse.builder()
                    .dayOfWeek(day)
                    .totalCalories(0)
                    .build());
        }
        return WeeklyMenuResponse.builder()
                .startDate(startDate)
                .endDate(startDate.plusDays(6))
                .meals(List.of())
                .dailyTotals(dailyCalories)
                .totalCalories(0)
                .build();
    }

    private LocalDate currentWeekStart() {
        return LocalDate.now().with(DayOfWeek.MONDAY);
    }
}
