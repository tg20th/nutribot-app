package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Integer> {

    /**
     * NB-83: Danh sach thong bao sap xep theo updated_at DESC (thoi diem tuong tac gan nhat).
     * COALESCE phong khi updated_at con NULL (du lieu cu), notificationId DESC lam tie-breaker
     * de phan trang on dinh khi nhieu thong bao trung updated_at.
     */
    @Query("SELECT n FROM Notification n WHERE n.recipient.userId = :recipientId "
            + "ORDER BY COALESCE(n.updatedAt, n.createdAt) DESC, n.createdAt DESC, n.notificationId DESC")
    Page<Notification> findByRecipientIdOrderByActivityDesc(@Param("recipientId") Integer recipientId, Pageable pageable);

    long countByRecipient_UserIdAndReadAtIsNull(Integer recipientId);

    Optional<Notification> findByNotificationIdAndRecipient_UserId(Integer notificationId, Integer recipientId);

    @Query("SELECT n FROM Notification n "
            + "WHERE n.recipient.userId = :recipientId AND n.type = :type "
            + "AND n.referenceType = :referenceType AND n.referenceId = :referenceId "
            + "ORDER BY COALESCE(n.updatedAt, n.createdAt) DESC")
    List<Notification> findLatestForGrouping(
            @Param("recipientId") Integer recipientId,
            @Param("type") String type,
            @Param("referenceType") String referenceType,
            @Param("referenceId") Integer referenceId,
            Pageable pageable);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("update Notification n set n.readAt = :readAt where n.recipient.userId = :recipientId and n.readAt is null")
    int markAllAsRead(@Param("recipientId") Integer recipientId, @Param("readAt") LocalDateTime readAt);
}
