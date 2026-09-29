package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.UserAllergy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserAllergyRepository extends JpaRepository<UserAllergy, Integer> {

    List<UserAllergy> findByUserProfileUserId(Integer userId);

    Optional<UserAllergy> findByUserProfileUserIdAndIngredientIngredientId(Integer userId, Integer ingredientId);

    void deleteByUserProfileUserIdAndIngredientIngredientId(Integer userId, Integer ingredientId);

    boolean existsByUserProfileUserIdAndIngredientIngredientId(Integer userId, Integer ingredientId);
}
