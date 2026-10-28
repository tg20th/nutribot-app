package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.RecipeStep;
import com.fpt.swp391.nutribot.entity.RecipeStepId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RecipeStepRepository extends JpaRepository<RecipeStep, RecipeStepId> {

    List<RecipeStep> findAllByRecipeIdOrderByStepNumberAsc(Integer recipeId);

    void deleteAllByRecipeId(Integer recipeId);
}
