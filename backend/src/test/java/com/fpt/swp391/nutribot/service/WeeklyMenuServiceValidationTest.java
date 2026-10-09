package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.WeeklyMenuAiSaveRequest;
import com.fpt.swp391.nutribot.dto.request.WeeklyMenuItemCreateRequest;
import com.fpt.swp391.nutribot.dto.response.MealPlanDayResponse;
import com.fpt.swp391.nutribot.dto.response.MealPlanDishResponse;
import com.fpt.swp391.nutribot.dto.response.MealPlanGenerateResponse;
import com.fpt.swp391.nutribot.dto.response.NutritionTargetResponse;
import com.fpt.swp391.nutribot.entity.DailyMenu;
import com.fpt.swp391.nutribot.entity.Dish;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.entity.Recipe;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserAllergy;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.entity.WeeklyMenu;
import com.fpt.swp391.nutribot.entity.WeeklyMenuItem;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.repository.DailyMenuRepository;
import com.fpt.swp391.nutribot.repository.DishRepository;
import com.fpt.swp391.nutribot.repository.RecipeIngredientRepository;
import com.fpt.swp391.nutribot.repository.RecipeRepository;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.repository.WeeklyMenuItemRepository;
import com.fpt.swp391.nutribot.repository.WeeklyMenuRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WeeklyMenuServiceValidationTest {

    @Mock private UserRepository userRepository;
    @Mock private UserProfileRepository userProfileRepository;
    @Mock private WeeklyMenuRepository weeklyMenuRepository;
    @Mock private DailyMenuRepository dailyMenuRepository;
    @Mock private WeeklyMenuItemRepository weeklyMenuItemRepository;
    @Mock private DishRepository dishRepository;
    @Mock private RecipeRepository recipeRepository;
    @Mock private RecipeIngredientRepository recipeIngredientRepository;
    @Mock private NutritionTargetService nutritionTargetService;

    @InjectMocks
    private WeeklyMenuService weeklyMenuService;

    // ===================== HELPER METHODS =====================

    private User mockUser() {
        User user = User.builder().userId(1).username("testuser").build();
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));
        return user;
    }

    private void mockWeeklyMenuNotFound(int userId, LocalDate startDate) {
        when(weeklyMenuRepository.findFirstByUserUserIdAndStartDateOrderByUpdatedAtDesc(userId, startDate))
                .thenReturn(Optional.empty());
        when(weeklyMenuRepository.save(any(WeeklyMenu.class))).thenAnswer(inv -> {
            WeeklyMenu w = inv.getArgument(0);
            w.setMenuId(100);
            return w;
        });
    }

    private void mockDishCatalog() {
        when(dailyMenuRepository.findByWeeklyMenuMenuIdOrderByDayOfWeekAscMealTypeAsc(anyInt()))
                .thenReturn(List.of());
        when(nutritionTargetService.getMissingFields(any())).thenReturn(List.of());
        when(nutritionTargetService.calculateTarget(any())).thenReturn(
                new NutritionTargetResponse(true, 2000, 100, 250, 65));
    }

    private WeeklyMenuAiSaveRequest buildValidRequest(LocalDate monday, int dishId) {
        MealPlanDishResponse breakfast = new MealPlanDishResponse();
        breakfast.setDishId(dishId);
        breakfast.setServings(BigDecimal.ONE);

        MealPlanDayResponse day = new MealPlanDayResponse();
        day.setBreakfast(breakfast);
        day.setLunch(breakfast);
        day.setDinner(breakfast);

        MealPlanGenerateResponse menu = new MealPlanGenerateResponse();
        menu.setSuggestedMenuTitle("Test Menu");
        menu.setEstimatedDailyCalories(2000);
        menu.setWeeklyPlan(List.of(day, day, day, day, day, day, day));

        WeeklyMenuAiSaveRequest req = new WeeklyMenuAiSaveRequest();
        req.setStartDate(monday);
        req.setGeneratedMenu(menu);
        return req;
    }

    // ===================== VEGETARIAN VALIDATION TESTS =====================

    @Nested
    @DisplayName("Vegetarian compatibility validation")
    class VegetarianValidation {

        @Test
        @DisplayName("VEGAN user - LACTO dish -> reject")
        void veganUserLactoDish_reject() {
            mockUser();
            LocalDate monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY);

            Dish lactoDish = Dish.builder()
                    .dishId(10).name("Sữa chua").active(true)
                    .calories(100).vegetarianType("LACTO").build();

            when(dishRepository.findAllByDishIdInAndActiveTrue(Set.of(10)))
                    .thenReturn(List.of(lactoDish));

            UserProfile profile = UserProfile.builder()
                    .user(User.builder().userId(1).build())
                    .vegetarianType("VEGAN")
                    .allergies(new HashSet<>())
                    .build();
            when(userProfileRepository.findById(1)).thenReturn(Optional.of(profile));

            WeeklyMenuAiSaveRequest req = buildValidRequest(monday, 10);

            assertThatThrownBy(() -> weeklyMenuService.saveAiGeneratedMenu("testuser", req))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("không tương thích");

            verify(weeklyMenuRepository, never()).save(any());
        }

        @Test
        @DisplayName("VEGAN user - VEGAN dish -> accept")
        void veganUserVeganDish_accept() {
            User user = mockUser();
            LocalDate monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY);

            Dish veganDish = Dish.builder()
                    .dishId(20).name("Salad").active(true)
                    .calories(100).vegetarianType("VEGAN").build();

            when(dishRepository.findAllByDishIdInAndActiveTrue(Set.of(20)))
                    .thenReturn(List.of(veganDish));

            UserProfile profile = UserProfile.builder()
                    .user(user)
                    .vegetarianType("VEGAN")
                    .allergies(new HashSet<>())
                    .build();
            when(userProfileRepository.findById(1)).thenReturn(Optional.of(profile));
            mockWeeklyMenuNotFound(1, monday);
            mockDishCatalog();

            WeeklyMenuAiSaveRequest req = buildValidRequest(monday, 20);

            // Should not throw
            weeklyMenuService.saveAiGeneratedMenu("testuser", req);

            verify(weeklyMenuRepository).save(any(WeeklyMenu.class));
        }

        @Test
        @DisplayName("LACTO user - VEGAN dish -> accept")
        void lactoUserVeganDish_accept() {
            User user = mockUser();
            LocalDate monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY);

            Dish veganDish = Dish.builder()
                    .dishId(30).name("Rau xào").active(true)
                    .calories(100).vegetarianType("VEGAN").build();

            when(dishRepository.findAllByDishIdInAndActiveTrue(Set.of(30)))
                    .thenReturn(List.of(veganDish));

            UserProfile profile = UserProfile.builder()
                    .user(user)
                    .vegetarianType("LACTO")
                    .allergies(new HashSet<>())
                    .build();
            when(userProfileRepository.findById(1)).thenReturn(Optional.of(profile));
            mockWeeklyMenuNotFound(1, monday);
            mockDishCatalog();

            WeeklyMenuAiSaveRequest req = buildValidRequest(monday, 30);

            weeklyMenuService.saveAiGeneratedMenu("testuser", req);

            verify(weeklyMenuRepository).save(any(WeeklyMenu.class));
        }

        @Test
        @DisplayName("LACTO user - OVO dish -> reject")
        void lactoUserOvoDish_reject() {
            mockUser();
            LocalDate monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY);

            Dish ovoDish = Dish.builder()
                    .dishId(40).name("Trứng").active(true)
                    .calories(100).vegetarianType("OVO").build();

            when(dishRepository.findAllByDishIdInAndActiveTrue(Set.of(40)))
                    .thenReturn(List.of(ovoDish));

            UserProfile profile = UserProfile.builder()
                    .user(User.builder().userId(1).build())
                    .vegetarianType("LACTO")
                    .allergies(new HashSet<>())
                    .build();
            when(userProfileRepository.findById(1)).thenReturn(Optional.of(profile));

            WeeklyMenuAiSaveRequest req = buildValidRequest(monday, 40);

            assertThatThrownBy(() -> weeklyMenuService.saveAiGeneratedMenu("testuser", req))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("không tương thích");

            verify(weeklyMenuRepository, never()).save(any());
        }

        @Test
        @DisplayName("LACTO_OVO user - VEGAN dish -> accept")
        void lactoOvoUserVeganDish_accept() {
            User user = mockUser();
            LocalDate monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY);

            Dish veganDish = Dish.builder()
                    .dishId(50).name("Salad").active(true)
                    .calories(100).vegetarianType("VEGAN").build();

            when(dishRepository.findAllByDishIdInAndActiveTrue(Set.of(50)))
                    .thenReturn(List.of(veganDish));

            UserProfile profile = UserProfile.builder()
                    .user(user)
                    .vegetarianType("LACTO_OVO")
                    .allergies(new HashSet<>())
                    .build();
            when(userProfileRepository.findById(1)).thenReturn(Optional.of(profile));
            mockWeeklyMenuNotFound(1, monday);
            mockDishCatalog();

            WeeklyMenuAiSaveRequest req = buildValidRequest(monday, 50);

            weeklyMenuService.saveAiGeneratedMenu("testuser", req);

            verify(weeklyMenuRepository).save(any(WeeklyMenu.class));
        }

        @Test
        @DisplayName("User không có vegetarian_type -> accept")
        void userNoVegetarianType_accept() {
            User user = mockUser();
            LocalDate monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY);

            Dish lactoDish = Dish.builder()
                    .dishId(60).name("Sữa").active(true)
                    .calories(100).vegetarianType("LACTO").build();

            when(dishRepository.findAllByDishIdInAndActiveTrue(Set.of(60)))
                    .thenReturn(List.of(lactoDish));

            UserProfile profile = UserProfile.builder()
                    .user(user)
                    .vegetarianType(null)
                    .allergies(new HashSet<>())
                    .build();
            when(userProfileRepository.findById(1)).thenReturn(Optional.of(profile));
            mockWeeklyMenuNotFound(1, monday);
            mockDishCatalog();

            WeeklyMenuAiSaveRequest req = buildValidRequest(monday, 60);

            weeklyMenuService.saveAiGeneratedMenu("testuser", req);

            verify(weeklyMenuRepository).save(any(WeeklyMenu.class));
        }

        @Test
        @DisplayName("Dish không có vegetarian_type -> reject")
        void dishNoVegetarianType_reject() {
            mockUser();
            LocalDate monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY);

            Dish unknownDish = Dish.builder()
                    .dishId(70).name("Món lạ").active(true)
                    .calories(100).vegetarianType(null).build();

            when(dishRepository.findAllByDishIdInAndActiveTrue(Set.of(70)))
                    .thenReturn(List.of(unknownDish));

            UserProfile profile = UserProfile.builder()
                    .user(User.builder().userId(1).build())
                    .vegetarianType("VEGAN")
                    .allergies(new HashSet<>())
                    .build();
            when(userProfileRepository.findById(1)).thenReturn(Optional.of(profile));

            WeeklyMenuAiSaveRequest req = buildValidRequest(monday, 70);

            assertThatThrownBy(() -> weeklyMenuService.saveAiGeneratedMenu("testuser", req))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("không tương thích");

            verify(weeklyMenuRepository, never()).save(any());
        }
    }

    // ===================== ALLERGY VALIDATION TESTS =====================

    @Nested
    @DisplayName("Allergy validation")
    class AllergyValidation {

        @Test
        @DisplayName("User dị ứng đậu phộng - dish chứa đậu phộng -> reject")
        void userAllergicToPeanut_dishContainsPeanut_reject() {
            mockUser();
            LocalDate monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY);

            Dish dish = Dish.builder()
                    .dishId(80).name("Salad đậu phộng").active(true)
                    .calories(100).vegetarianType("VEGAN").build();

            when(dishRepository.findAllByDishIdInAndActiveTrue(Set.of(80)))
                    .thenReturn(List.of(dish));

            Ingredient peanut = Ingredient.builder()
                    .ingredientId(5).name("Đậu phộng").build();
            UserAllergy allergy = UserAllergy.builder()
                    .ingredient(peanut)
                    .build();

            Set<UserAllergy> allergies = new HashSet<>();
            allergies.add(allergy);

            UserProfile profile = UserProfile.builder()
                    .user(User.builder().userId(1).build())
                    .vegetarianType("VEGAN")
                    .allergies(allergies)
                    .build();
            when(userProfileRepository.findById(1)).thenReturn(Optional.of(profile));

            Recipe recipe = Recipe.builder().recipeId(1).dishId(80).build();
            when(recipeRepository.findByDishId(80)).thenReturn(Optional.of(recipe));
            when(recipeIngredientRepository.findIngredientIdsByRecipeId(1)).thenReturn(List.of(5));

            WeeklyMenuAiSaveRequest req = buildValidRequest(monday, 80);

            assertThatThrownBy(() -> weeklyMenuService.saveAiGeneratedMenu("testuser", req))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("dị ứng")
                    .hasMessageContaining("Đậu phộng");

            verify(weeklyMenuRepository, never()).save(any());
        }

        @Test
        @DisplayName("User dị ứng đậu phộng - dish không chứa đậu phộng -> accept")
        void userAllergicToPeanut_dishNoPeanut_accept() {
            User user = mockUser();
            LocalDate monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY);

            Dish dish = Dish.builder()
                    .dishId(90).name("Salad rau").active(true)
                    .calories(100).vegetarianType("VEGAN").build();

            when(dishRepository.findAllByDishIdInAndActiveTrue(Set.of(90)))
                    .thenReturn(List.of(dish));

            Ingredient peanut = Ingredient.builder()
                    .ingredientId(5).name("Đậu phộng").build();
            UserAllergy allergy = UserAllergy.builder()
                    .ingredient(peanut)
                    .build();

            Set<UserAllergy> allergies = new HashSet<>();
            allergies.add(allergy);

            UserProfile profile = UserProfile.builder()
                    .user(user)
                    .vegetarianType("VEGAN")
                    .allergies(allergies)
                    .build();
            when(userProfileRepository.findById(1)).thenReturn(Optional.of(profile));

            Recipe recipe = Recipe.builder().recipeId(1).dishId(90).build();
            when(recipeRepository.findByDishId(90)).thenReturn(Optional.of(recipe));
            when(recipeIngredientRepository.findIngredientIdsByRecipeId(1)).thenReturn(List.of(1, 2, 3)); // no peanut

            mockWeeklyMenuNotFound(1, monday);
            mockDishCatalog();

            WeeklyMenuAiSaveRequest req = buildValidRequest(monday, 90);

            weeklyMenuService.saveAiGeneratedMenu("testuser", req);

            verify(weeklyMenuRepository).save(any(WeeklyMenu.class));
        }

        @Test
        @DisplayName("Dish không có recipe -> accept (no ingredients to check)")
        void dishNoRecipe_accept() {
            User user = mockUser();
            LocalDate monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY);

            Dish dish = Dish.builder()
                    .dishId(100).name("Món không có công thức").active(true)
                    .calories(100).vegetarianType("VEGAN").build();

            when(dishRepository.findAllByDishIdInAndActiveTrue(Set.of(100)))
                    .thenReturn(List.of(dish));

            Ingredient peanut = Ingredient.builder()
                    .ingredientId(5).name("Đậu phộng").build();
            UserAllergy allergy = UserAllergy.builder()
                    .ingredient(peanut)
                    .build();

            Set<UserAllergy> allergies = new HashSet<>();
            allergies.add(allergy);

            UserProfile profile = UserProfile.builder()
                    .user(user)
                    .vegetarianType("VEGAN")
                    .allergies(allergies)
                    .build();
            when(userProfileRepository.findById(1)).thenReturn(Optional.of(profile));

            when(recipeRepository.findByDishId(100)).thenReturn(Optional.empty());

            mockWeeklyMenuNotFound(1, monday);
            mockDishCatalog();

            WeeklyMenuAiSaveRequest req = buildValidRequest(monday, 100);

            // No recipe = no ingredients to check = accept
            weeklyMenuService.saveAiGeneratedMenu("testuser", req);

            verify(weeklyMenuRepository).save(any(WeeklyMenu.class));
        }
    }

    // ===================== DAY-LEVEL WARNING TESTS =====================

    @Nested
    @DisplayName("Day-level nutrition warning")
    class DailyWarningValidation {

        @Test
        @DisplayName("Adding a dish warns using the whole-day total, not just the meal")
        void addItemWarnsUsingWholeDayTotal() {
            User user = mockUser();

            WeeklyMenu menu = WeeklyMenu.builder()
                    .menuId(100)
                    .user(user)
                    .startDate(LocalDate.now().with(java.time.DayOfWeek.MONDAY))
                    .endDate(LocalDate.now().with(java.time.DayOfWeek.MONDAY).plusDays(6))
                    .build();
            when(weeklyMenuRepository.findByMenuIdAndUserUserId(100, 1)).thenReturn(Optional.of(menu));

            Dish existingDish = Dish.builder()
                    .dishId(1).name("Cơm").active(true).calories(400).proteinG(new BigDecimal("10")).build();
            Dish newDish = Dish.builder()
                    .dishId(2).name("Bò").active(true).calories(900).proteinG(new BigDecimal("20")).build();
            when(dishRepository.findByDishIdAndActiveTrue(2)).thenReturn(Optional.of(newDish));

            DailyMenu lunch = DailyMenu.builder()
                    .mealId(50).weeklyMenu(menu).dayOfWeek(2).mealType("lunch").build();
            when(dailyMenuRepository.findByWeeklyMenuMenuIdAndDayOfWeekAndMealType(100, 2, "lunch"))
                    .thenReturn(Optional.of(lunch));
            when(weeklyMenuItemRepository.existsByDailyMenuMealIdAndDishDishId(50, 2)).thenReturn(false);

            WeeklyMenuItem existingItem = WeeklyMenuItem.builder()
                    .itemId(7).dailyMenu(lunch).dish(existingDish).servings(BigDecimal.ONE).build();
            WeeklyMenuItem savedItem = WeeklyMenuItem.builder()
                    .itemId(8).dailyMenu(lunch).dish(newDish).servings(BigDecimal.ONE).build();
            when(weeklyMenuItemRepository.save(any(WeeklyMenuItem.class))).thenReturn(savedItem);

            when(dailyMenuRepository.findByWeeklyMenuMenuIdOrderByDayOfWeekAscMealTypeAsc(100))
                    .thenReturn(List.of(lunch));
            when(weeklyMenuItemRepository.findByDailyMenu_MealIdIn(List.of(50)))
                    .thenReturn(List.of(existingItem));

            when(nutritionTargetService.getMissingFields("testuser")).thenReturn(List.of());
            when(nutritionTargetService.calculateTarget("testuser"))
                    .thenReturn(new NutritionTargetResponse(true, 1000, 100, 250, 65));

            WeeklyMenuItemCreateRequest request = WeeklyMenuItemCreateRequest.builder()
                    .dayOfWeek(2).mealType("lunch").dishId(2)
                    .servings(BigDecimal.ONE).build();

            WeeklyMenuService.AddMealResult result = weeklyMenuService.addWeeklyMenuItem("testuser", 100, request);

            // 400 (existing) + 900 (new) = 1300 > 1000 daily target -> over by 300
            assertThat(result.warnings())
                    .anyMatch(warning -> warning.contains("vượt 300 kcal"));
            assertThat(result.warnings())
                    .allMatch(warning -> warning.contains("Tổng"));
        }
    }
}
