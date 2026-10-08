package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.DishDetailResponse;
import com.fpt.swp391.nutribot.dto.response.IngredientDetailDto;
import com.fpt.swp391.nutribot.dto.response.RecipeDetailDto;
import com.fpt.swp391.nutribot.entity.Dish;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.entity.Recipe;
import com.fpt.swp391.nutribot.entity.RecipeIngredient;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.DishRepository;
import com.fpt.swp391.nutribot.repository.IngredientRepository;
import com.fpt.swp391.nutribot.repository.RecipeIngredientRepository;
import com.fpt.swp391.nutribot.repository.RecipeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DishService {

    private final DishRepository dishRepository;
    private final RecipeRepository recipeRepository;
    private final RecipeIngredientRepository recipeIngredientRepository;
    private final IngredientRepository ingredientRepository;

    @Transactional(readOnly = true)
    public DishDetailResponse getDishDetail(Integer dishId) {
        Dish dish = dishRepository.findByDishIdAndActiveTrue(dishId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy món ăn với dishId: " + dishId));

        RecipeDetailDto recipeDto = null;
        Recipe recipe = recipeRepository.findByDishId(dishId).orElse(null);
        if (recipe != null) {
            List<RecipeIngredient> recipeIngredients = recipeIngredientRepository.findAllByRecipeId(recipe.getRecipeId());

            List<IngredientDetailDto> ingredientDtos = List.of();
            if (!recipeIngredients.isEmpty()) {
                List<Integer> ingredientIds = recipeIngredients.stream()
                        .map(RecipeIngredient::getIngredientId)
                        .toList();
                Map<Integer, Ingredient> ingredientMap = ingredientRepository.findAllById(ingredientIds).stream()
                        .collect(Collectors.toMap(Ingredient::getIngredientId, Function.identity()));
                ingredientDtos = recipeIngredients.stream()
                        .map(ri -> {
                            Ingredient ing = ingredientMap.get(ri.getIngredientId());
                            return IngredientDetailDto.builder()
                                    .ingredientId(ri.getIngredientId())
                                    .name(ing != null ? ing.getName() : null)
                                    .quantity(null)
                                    .unit(null)
                                    .build();
                        })
                        .toList();
            }

            recipeDto = RecipeDetailDto.builder()
                    .recipeId(recipe.getRecipeId())
                    .title(recipe.getTitle())
                    .description(recipe.getDescription())
                    .instructions(recipe.getInstructions())
                    .servings(recipe.getServings())
                    .prepTimeMin(recipe.getPrepTimeMin())
                    .cookTimeMin(recipe.getCookTimeMin())
                    .ingredients(ingredientDtos)
                    .build();
        }

        return DishDetailResponse.builder()
                .dishId(dish.getDishId())
                .name(dish.getName())
                .description(dish.getDescription())
                .imageUrl(dish.getImageUrl())
                .calories(dish.getCalories())
                .proteinG(dish.getProteinG())
                .carbsG(dish.getCarbsG())
                .healthyFatsG(dish.getHealthyFatsG())
                .servingSize(dish.getServingSize())
                .servingUnit(dish.getServingUnit())
                .vegetarianType(dish.getVegetarianType())
                .recipe(recipeDto)
                .build();
    }
}
