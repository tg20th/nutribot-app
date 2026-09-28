package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.EmailChangeRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.time.LocalDateTime;

public interface EmailChangeRequestRepository extends JpaRepository<EmailChangeRequest, Integer> {

    boolean existsByPendingEmailIgnoreCaseAndUser_UserIdNot(String pendingEmail, Integer userId);

    void deleteByExpiresAtLessThanEqual(LocalDateTime now);
}
