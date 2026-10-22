package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Dish;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DishRepository extends JpaRepository<Dish, Integer> {

    Optional<Dish> findByDishIdAndActiveTrue(Integer dishId);

    Optional<Dish> findByNameIgnoreCase(String name);

    Optional<Dish> findBySlug(String slug);

    boolean existsBySlug(String slug);

    List<Dish> findAllByDishIdInAndActiveTrue(Collection<Integer> dishIds);

    List<Dish> findAllByActiveTrueAndCaloriesIsNotNullOrderByNameAsc();

    List<Dish> findAllByActiveTrueAndCaloriesIsNotNullAndProteinGIsNotNullOrderByNameAsc();
}
