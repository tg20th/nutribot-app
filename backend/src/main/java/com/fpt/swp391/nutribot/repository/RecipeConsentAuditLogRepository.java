package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.RecipeConsentAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecipeConsentAuditLogRepository extends JpaRepository<RecipeConsentAuditLog, Integer> {

    List<RecipeConsentAuditLog> findByContentIdOrderByChangedAtDesc(Integer contentId);
}
