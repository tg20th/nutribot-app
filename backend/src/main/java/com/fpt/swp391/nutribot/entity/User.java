package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Integer userId;

    @Column(name = "username", nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "full_name", length = 150)
    private String fullName;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(name = "bio", length = 500)
    private String bio;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Column(name = "strike_count", nullable = false)
    @Builder.Default
    private Integer strikeCount = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private AccountStatus status = AccountStatus.ACTIVE;

    @Column(name = "auth_provider", nullable = false, length = 20)
    @Builder.Default
    private String authProvider = "LOCAL";

    @Column(name = "has_password", nullable = false)
    @Builder.Default
    private Boolean hasPassword = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void onCreate() {
        if (email != null) {
            email = email.trim().toLowerCase();
        }
        if (username != null) {
            username = username.trim();
        }
        if (status == null) {
            status = AccountStatus.ACTIVE;
        }
        if (authProvider == null || authProvider.isBlank()) {
            authProvider = "LOCAL";
        }
        if (hasPassword == null) {
            hasPassword = true;
        }
        if (strikeCount == null || strikeCount < 0) {
            strikeCount = 0;
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void onUpdate() {
        if (email != null) {
            email = email.trim().toLowerCase();
        }
        if (username != null) {
            username = username.trim();
        }
        if (strikeCount == null || strikeCount < 0) {
            strikeCount = 0;
        }
        updatedAt = LocalDateTime.now();
    }
}
