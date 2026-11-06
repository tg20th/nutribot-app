package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.ModerationDecisionAudit;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ModerationDecisionAuditRepository extends JpaRepository<ModerationDecisionAudit, Long> {
    @Query("select a from ModerationDecisionAudit a where (:query is null or lower(a.contentTitle) like lower(concat('%', :query, '%')) or cast(a.contentId as string) = :query or lower(coalesce(a.authorUsername, '')) like lower(concat('%', :query, '%'))) and (:action is null or a.action = :action) and (:contentType is null or a.contentType = :contentType) and (:adminUsername is null or a.adminUsername = :adminUsername) and (:fromAt is null or a.decidedAt >= :fromAt) and (:toAt is null or a.decidedAt < :toAt)")
    Page<ModerationDecisionAudit> search(@Param("query") String query, @Param("action") String action, @Param("contentType") String contentType, @Param("adminUsername") String adminUsername, @Param("fromAt") LocalDateTime fromAt, @Param("toAt") LocalDateTime toAt, Pageable pageable);
    List<ModerationDecisionAudit> findByContentIdOrderByDecidedAtAscAuditIdAsc(Integer contentId);
    Page<ModerationDecisionAudit> findByAuthorIdAndActionOrderByDecidedAtDescAuditIdDesc(Integer authorId, String action, Pageable pageable);
}
