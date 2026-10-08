package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.request.MealPlanGenerateRequest;
import com.fpt.swp391.nutribot.dto.response.MealPlanGenerateResponse;
import com.fpt.swp391.nutribot.dto.response.NutritionTargetResponse;
import com.fpt.swp391.nutribot.entity.Dish;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.exception.ProfileIncompleteException;
import com.fpt.swp391.nutribot.repository.DishRepository;
import com.fpt.swp391.nutribot.repository.IngredientRepository;
import com.fpt.swp391.nutribot.repository.RecipeIngredientRepository;
import com.fpt.swp391.nutribot.repository.RecipeRepository;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MealPlannerServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserProfileRepository userProfileRepository;

    @Mock
    private DishRepository dishRepository;

    @Mock
    private RecipeRepository recipeRepository;

    @Mock
    private RecipeIngredientRepository recipeIngredientRepository;

    @Mock
    private IngredientRepository ingredientRepository;

    @Mock
    private NutritionTargetService nutritionTargetService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private MealPlannerService mealPlannerService;

    @Test
    @DisplayName("Ném ProfileIncompleteException khi người dùng chưa hoàn thiện hồ sơ sức khỏe")
    void testThrowProfileIncompleteWhenProfileMissing() {
        String username = "incomplete_user";
        User user = User.builder().userId(10).username(username).build();
        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));
        when(userProfileRepository.findById(10)).thenReturn(Optional.empty());

        Dish dish = Dish.builder().dishId(1).name("Món 1").calories(300).proteinG(new BigDecimal("15")).build();
        when(dishRepository.findAllByActiveTrueAndCaloriesIsNotNullAndProteinGIsNotNullOrderByNameAsc())
                .thenReturn(List.of(dish));

        when(nutritionTargetService.calculateTarget(username))
                .thenThrow(new ProfileIncompleteException(List.of("heightCm", "weightKg")));

        MealPlanGenerateRequest request = new MealPlanGenerateRequest();
        request.setHealthGoal("maintain");

        assertThatThrownBy(() -> mealPlannerService.generate(username, request))
                .isInstanceOf(ProfileIncompleteException.class)
                .satisfies(ex -> {
                    ProfileIncompleteException pie = (ProfileIncompleteException) ex;
                    assertThat(pie.getMissingFields()).contains("heightCm", "weightKg");
                });
    }
}
