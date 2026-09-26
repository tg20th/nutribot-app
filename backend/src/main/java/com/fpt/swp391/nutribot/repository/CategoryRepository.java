package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Integer> {

    Optional<Category> findBySlug(String slug);

    @Query("SELECT c FROM Category c WHERE c.active = true ORDER BY c.categoryName ASC")
    List<Category> findRootCategories();

    @Query("SELECT c FROM Category c WHERE c.active = true AND (:type IS NULL OR c.categoryType = :type) ORDER BY c.categoryName ASC")
    List<Category> findActiveCategories(@Param("type") String type);
}
