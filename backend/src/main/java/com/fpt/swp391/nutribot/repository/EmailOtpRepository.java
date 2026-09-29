package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.EmailOtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface EmailOtpRepository extends JpaRepository<EmailOtp, Integer> {

    List<EmailOtp> findAllByEmailIgnoreCaseAndPurposeAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
            String email, String purpose, LocalDateTime now);

    Optional<EmailOtp> findFirstByUserIdAndPurposeAndIsUsedFalseOrderByCreatedAtDesc(
            Integer userId, String purpose);

    boolean existsByEmailIgnoreCaseAndPurposeAndIsUsedFalseAndUserIdNot(
            String email, String purpose, Integer userId);

    @Modifying
    @Query("DELETE FROM EmailOtp e WHERE e.purpose = 'REGISTRATION' AND (e.expiresAt < :now OR e.isUsed = true)")
    void deleteExpiredOrUsed(LocalDateTime now);

    @Modifying
    @Query("DELETE FROM EmailOtp e WHERE e.purpose = 'EMAIL_CHANGE' AND e.expiresAt <= :now")
    void deleteExpiredEmailChanges(@Param("now") LocalDateTime now);
}
