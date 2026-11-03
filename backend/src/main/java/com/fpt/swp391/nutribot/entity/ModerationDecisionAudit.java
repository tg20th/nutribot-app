package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "content_moderation_audit")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ModerationDecisionAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "audit_id") private Long auditId;
    @Column(name = "content_id", nullable = false) private Integer contentId;
    @Column(name = "content_type", nullable = false, length = 10) private String contentType;
    @Column(name = "content_title", nullable = false, length = 255) private String contentTitle;
    @Column(name = "author_id") private Integer authorId;
    @Column(name = "author_username", length = 50) private String authorUsername;
    @Column(name = "previous_status", nullable = false, length = 20) private String previousStatus;
    @Column(name = "new_status", nullable = false, length = 20) private String newStatus;
    @Column(name = "action", nullable = false, length = 10) private String action;
    @Column(name = "admin_id", nullable = false) private Integer adminId;
    @Column(name = "admin_username", nullable = false, length = 50) private String adminUsername;
    @Column(name = "admin_reason", columnDefinition = "NVARCHAR(MAX)") private String adminReason;
    @Column(name = "decided_at", nullable = false, updatable = false) private LocalDateTime decidedAt;
    @Column(name = "ai_flagged") private Boolean aiFlagged;
    @Column(name = "ai_reason", columnDefinition = "NVARCHAR(MAX)") private String aiReason;
    @Column(name = "ai_confidence", precision = 5, scale = 4) private BigDecimal aiConfidence;
    @Column(name = "content_body_snapshot", columnDefinition = "NVARCHAR(MAX)") private String contentBodySnapshot;
    @Column(name = "thumbnail_url_snapshot", length = 500) private String thumbnailUrlSnapshot;
    @Column(name = "media_url_snapshot", length = 500) private String mediaUrlSnapshot;
    @PrePersist protected void onCreate() { if (decidedAt == null) decidedAt = LocalDateTime.now(); }
}
