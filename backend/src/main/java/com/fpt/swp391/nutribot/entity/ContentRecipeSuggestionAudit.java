package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * NB-84: Nhat ky append-only moi thay doi trang thai cua de xuat cong thuc.
 * Ghi lai ai thuc hien hanh dong gi va vi ly do de doi soat lai duong.
 */
@Entity
@Table(name = "content_recipe_suggestion_audit")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContentRecipeSuggestionAudit {

    public static final String ACTION_SUGGESTED = "SUGGESTED";
    public static final String ACTION_APPROVED = "APPROVED";
    public static final String ACTION_REJECTED = "REJECTED";
    public static final String ACTION_AUTO_REJECTED = "AUTO_REJECTED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "audit_id")
    private Integer auditId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "suggestion_id", nullable = false)
    private ContentRecipeSuggestion suggestion;

    @Column(name = "action", nullable = false, length = 30)
    private String action;

    @Column(name = "actor_id")
    private Integer actorId;

    @Column(name = "reason", columnDefinition = "NVARCHAR(MAX)")
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
