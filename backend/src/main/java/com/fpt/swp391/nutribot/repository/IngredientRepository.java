package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Ingredient;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface IngredientRepository extends JpaRepository<Ingredient, Integer> {
    List<Ingredient> findAllByActiveTrueOrderByNameAsc();
    List<Ingredient> findAllByIngredientIdInAndActiveTrue(Collection<Integer> ingredientIds);
}
