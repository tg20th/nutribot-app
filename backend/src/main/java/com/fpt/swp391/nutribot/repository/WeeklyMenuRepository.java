package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.WeeklyMenu;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface WeeklyMenuRepository extends JpaRepository<WeeklyMenu, Integer> {

    Optional<WeeklyMenu> findFirstByUserUserIdAndStartDateOrderByUpdatedAtDesc(
            Integer userId,
            LocalDate startDate
    );

    Optional<WeeklyMenu> findByMenuIdAndUserUserId(Integer menuId, Integer userId);
}
