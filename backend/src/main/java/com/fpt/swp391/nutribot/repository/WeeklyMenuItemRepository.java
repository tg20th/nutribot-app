package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.WeeklyMenuItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface WeeklyMenuItemRepository extends JpaRepository<WeeklyMenuItem, Integer> {

    List<WeeklyMenuItem> findByDailyMenu_MealIdIn(Collection<Integer> mealIds);

    boolean existsByDailyMenuMealIdAndDishDishId(Integer mealId, Integer dishId);

    List<WeeklyMenuItem> findByDailyMenuMealId(Integer mealId);
}
