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
import java.util.List;
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

    /**
     * NB-84: Tac gia xem cac de xuat cong thuc cua chinh minh.
     */
    @EntityGraph(attributePaths = {"content", "content.user"})
    Page<ContentRecipeSuggestion> findByContentUserUserId(Integer userId, Pageable pageable);

    @EntityGraph(attributePaths = {"content", "content.user"})
    Page<ContentRecipeSuggestion> findByContentUserUserIdAndStatusIn(
            Integer userId, Collection<String> statuses, Pageable pageable);

    @EntityGraph(attributePaths = {"content", "content.user"})
    Optional<ContentRecipeSuggestion> findBySuggestionIdAndContentUserUserId(
            Integer suggestionId, Integer userId);

    /**
     * NB-84: Cac de xuat con PENDING nhung bai viet da bi tac gia rut dong thuan.
     * Dung cho job quet de doi soat lai va chuyen sang REJECTED, tranh de xuat bi ket.
     */
    @Query("SELECT s FROM ContentRecipeSuggestion s JOIN FETCH s.content c "
            + "WHERE s.status = 'PENDING' AND COALESCE(c.recipeConsent, false) = false")
    List<ContentRecipeSuggestion> findPendingWithoutConsent();

    /**
     * NB-84: Cac de xuat dang PENDING cua 1 bai viet, dung khi tac gia rut dong thuan.
     */
    @EntityGraph(attributePaths = {"content", "content.user"})
    List<ContentRecipeSuggestion> findByContentContentIdAndStatusIn(
            Integer contentId, Collection<String> statuses);
}
