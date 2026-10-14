package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestion;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;

@Repository
public interface ContentRecipeSuggestionRepository extends JpaRepository<ContentRecipeSuggestion, Integer> {

    boolean existsByContentContentIdAndStatusIn(Integer contentId, Collection<String> statuses);

    Optional<ContentRecipeSuggestion> findFirstByContentContentIdAndStatusIn(Integer contentId, Collection<String> statuses);

    @EntityGraph(attributePaths = {"content", "content.user"})
    Page<ContentRecipeSuggestion> findByStatus(String status, Pageable pageable);

    @EntityGraph(attributePaths = {"content", "content.user"})
    @Query("SELECT s FROM ContentRecipeSuggestion s")
    Page<ContentRecipeSuggestion> findAllWithContent(Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM ContentRecipeSuggestion s WHERE s.suggestionId = :suggestionId")
    Optional<ContentRecipeSuggestion> findByIdForUpdate(@Param("suggestionId") Integer suggestionId);

    @EntityGraph(attributePaths = {"content", "content.user"})
    @Query("SELECT s FROM ContentRecipeSuggestion s WHERE s.suggestionId = :suggestionId")
    Optional<ContentRecipeSuggestion> findDetailById(@Param("suggestionId") Integer suggestionId);
}
