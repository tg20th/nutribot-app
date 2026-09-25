package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Ingredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IngredientRepository extends JpaRepository<Ingredient, Integer> {

    List<Ingredient> findByActiveTrueOrderByNameAsc();
}
