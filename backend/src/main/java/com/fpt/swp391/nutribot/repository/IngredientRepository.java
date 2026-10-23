package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Ingredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface IngredientRepository extends JpaRepository<Ingredient, Integer> {
    List<Ingredient> findAllByActiveTrueOrderByNameAsc();
    List<Ingredient> findAllByIngredientIdInAndActiveTrue(Collection<Integer> ingredientIds);
    Optional<Ingredient> findByNameIgnoreCase(String name);

    boolean existsBySlug(String slug);

    boolean existsByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCaseAndIngredientIdNot(String name, Integer ingredientId);
    boolean existsBySlugIgnoreCase(String slug);
    boolean existsBySlugIgnoreCaseAndIngredientIdNot(String slug, Integer ingredientId);

    @Query("SELECT i FROM Ingredient i WHERE "
            + "(:keyword IS NULL OR LOWER(i.name) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + "OR LOWER(i.slug) LIKE LOWER(CONCAT('%', :keyword, '%'))) "
            + "AND (:categoryId IS NULL OR i.categoryId = :categoryId) "
            + "AND (:active IS NULL OR i.active = :active)")
    Page<Ingredient> searchAdminIngredients(@Param("keyword") String keyword,
                                             @Param("categoryId") Integer categoryId,
                                             @Param("active") Boolean active,
                                             Pageable pageable);
}
