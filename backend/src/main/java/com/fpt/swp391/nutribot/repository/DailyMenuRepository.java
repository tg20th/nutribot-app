package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.DailyMenu;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DailyMenuRepository extends JpaRepository<DailyMenu, Integer> {

    List<DailyMenu> findByWeeklyMenuMenuIdOrderByDayOfWeekAscMealTypeAsc(Integer menuId);

    Optional<DailyMenu> findByWeeklyMenuMenuIdAndDayOfWeekAndMealType(
            Integer menuId,
            Integer dayOfWeek,
            String mealType
    );
}
