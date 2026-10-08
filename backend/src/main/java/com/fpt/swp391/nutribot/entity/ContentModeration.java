package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "content_moderations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContentModeration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "moderation_id")
    private Integer moderationId;

    @Column(name = "content_id", nullable = false, unique = true)
    private Integer contentId;

    @Column(name = "ai_flagged", nullable = false)
    @Builder.Default
    private Boolean aiFlagged = true;

    @Column(name = "ai_reason", columnDefinition = "NVARCHAR(MAX)")
    private String aiReason;

    @Column(name = "ai_confidence", precision = 5, scale = 4)
    private BigDecimal aiConfidence;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "pending";

    @Column(name = "reviewed_by")
    private Integer reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "admin_note", columnDefinition = "NVARCHAR(MAX)")
    private String adminNote;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
