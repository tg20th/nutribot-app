package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.UserProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserProfileRepository extends JpaRepository<UserProfile, Integer> {
}
