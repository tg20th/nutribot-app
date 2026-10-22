package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestionAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContentRecipeSuggestionAuditRepository extends JpaRepository<ContentRecipeSuggestionAudit, Integer> {

    List<ContentRecipeSuggestionAudit> findBySuggestionSuggestionIdOrderByCreatedAtDesc(Integer suggestionId);
}
