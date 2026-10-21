package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.MyRecipeResponse;
import com.fpt.swp391.nutribot.entity.Dish;
import com.fpt.swp391.nutribot.entity.Recipe;
import org.springframework.stereotype.Component;

@Component
public class RecipeResponseMapper {

    public MyRecipeResponse toResponse(Recipe recipe) {
        if (recipe == null) {
            return null;
        }
        Dish dish = recipe.getDish();
        if (dish != null && Boolean.FALSE.equals(dish.getActive())) {
            return null;
        }
        String name = dish != null && dish.getName() != null ? dish.getName() : recipe.getTitle();
        String description = dish != null && dish.getDescription() != null ? dish.getDescription() : recipe.getDescription();
        return MyRecipeResponse.builder()
                .dishId(recipe.getDishId())
                .recipeId(recipe.getRecipeId())
                .name(name)
                .description(description)
                .imageUrl(dish != null ? dish.getImageUrl() : null)
                .preparationTime(recipe.getPrepTimeMin())
                .prepTimeMinutes(recipe.getPrepTimeMin())
                .cookTimeMinutes(recipe.getCookTimeMin())
                .servings(recipe.getServings())
                .build();
    }
}
