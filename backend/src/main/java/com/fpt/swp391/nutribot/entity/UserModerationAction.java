package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_moderation_actions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserModerationAction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "action_id") private Long actionId;
    @Column(name = "user_id", nullable = false) private Integer userId;
    @Column(name = "admin_id") private Integer adminId;
    @Column(name = "action", nullable = false, length = 30) private String action;
    @Column(name = "source", nullable = false, length = 20) private String source;
    @Column(name = "previous_status", length = 20) private String previousStatus;
    @Column(name = "new_status", nullable = false, length = 20) private String newStatus;
    @Column(name = "strike_delta", nullable = false) private Short strikeDelta;
    @Column(name = "reason", nullable = false, columnDefinition = "NVARCHAR(1000)") private String reason;
    @Column(name = "additional_explanation", columnDefinition = "NVARCHAR(1000)") private String additionalExplanation;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @PrePersist void onCreate() { if (createdAt == null) createdAt = LocalDateTime.now(); if (strikeDelta == null) strikeDelta = 0; }
}
