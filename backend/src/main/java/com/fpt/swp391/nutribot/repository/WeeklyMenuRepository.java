package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.WeeklyMenu;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WeeklyMenuRepository extends JpaRepository<WeeklyMenu, Integer> {
}
