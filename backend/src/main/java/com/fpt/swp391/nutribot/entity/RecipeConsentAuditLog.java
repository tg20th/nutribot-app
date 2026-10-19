package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * NB-80: Ghi nhận mọi thay đổi trạng thái đồng thuận dùng công thức
 * (append-only audit log).
 */
@Entity
@Table(name = "recipe_consent_audit_log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecipeConsentAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "audit_id")
    private Integer auditId;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "content_id", nullable = false)
    private Integer contentId;

    @Column(name = "previous_value")
    private Boolean previousValue;

    @Column(name = "new_value", nullable = false)
    private Boolean newValue;

    @Column(name = "terms_version", length = 20)
    private String termsVersion;

    @Column(name = "source", nullable = false, length = 20)
    private String source;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private LocalDateTime changedAt;

    @PrePersist
    protected void onCreate() {
        if (changedAt == null) changedAt = LocalDateTime.now();
    }
}
