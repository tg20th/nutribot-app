package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.UserProfile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserProfileRepository extends JpaRepository<UserProfile, Integer> {
}
