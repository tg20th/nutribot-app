package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.EmailOtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface EmailOtpRepository extends JpaRepository<EmailOtp, Integer> {

    Optional<EmailOtp> findByEmailAndOtpCodeAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
            String email, String otpCode, LocalDateTime now);

    @Modifying
    @Query("UPDATE EmailOtp e SET e.isUsed = true WHERE e.email = :email")
    void markAsUsedByEmail(@Param("email") String email);

    @Modifying
    @Query("DELETE FROM EmailOtp e WHERE e.expiresAt < :now OR e.isUsed = true")
    void deleteExpiredOrUsed(LocalDateTime now);
}