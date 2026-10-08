package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.RecipeIngredient;
import com.fpt.swp391.nutribot.entity.RecipeIngredientId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RecipeIngredientRepository extends JpaRepository<RecipeIngredient, RecipeIngredientId> {

    @Query("SELECT ri.ingredientId FROM RecipeIngredient ri WHERE ri.recipeId = :recipeId")
    List<Integer> findIngredientIdsByRecipeId(@Param("recipeId") Integer recipeId);

    @Query("SELECT ri.ingredientId FROM RecipeIngredient ri WHERE ri.recipeId IN :recipeIds")
    List<Integer> findIngredientIdsByRecipeIds(@Param("recipeIds") List<Integer> recipeIds);

    @Query("SELECT ri.recipeId FROM RecipeIngredient ri WHERE ri.ingredientId = :ingredientId")
    List<Integer> findRecipeIdsByIngredientId(@Param("ingredientId") Integer ingredientId);
}
