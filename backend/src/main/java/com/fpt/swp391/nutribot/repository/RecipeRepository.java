package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Recipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RecipeRepository extends JpaRepository<Recipe, Integer> {

    Optional<Recipe> findByDishId(Integer dishId);

    Optional<Recipe> findFirstBySourceContentId(Integer sourceContentId);

    boolean existsBySlug(String slug);

    long countBySourceUserIdAndStatus(Integer sourceUserId, String status);

    List<Recipe> findBySourceUserIdOrderByCreatedAtDesc(Integer sourceUserId);

    List<Recipe> findBySourceUserIdAndStatusOrderByCreatedAtDesc(Integer sourceUserId, String status);
}
