package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestionIngredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContentRecipeSuggestionIngredientRepository
        extends JpaRepository<ContentRecipeSuggestionIngredient, Integer> {

    List<ContentRecipeSuggestionIngredient> findAllBySuggestionIdOrderBySortOrderAsc(Integer suggestionId);

    void deleteAllBySuggestionId(Integer suggestionId);
}
