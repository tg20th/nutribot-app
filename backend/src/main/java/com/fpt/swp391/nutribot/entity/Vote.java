package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "votes", uniqueConstraints = {
    @UniqueConstraint(name = "UQ_votes_user_content", columnNames = {"user_id", "content_id"})
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Vote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "vote_id")
    private Integer voteId;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "content_id", nullable = false)
    private Integer contentId;

    @Column(name = "vote_value", nullable = false)
    @Builder.Default
    private Short voteValue = 1;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "content_id", insertable = false, updatable = false)
    private Content content;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (voteValue == null) {
            voteValue = 1;
        }
    }
}
