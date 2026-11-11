package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "content_view_events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ContentViewEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "view_event_id") private Long viewEventId;
    @Column(name = "user_id", nullable = false) private Integer userId;
    @Column(name = "content_id", nullable = false) private Integer contentId;
    @Column(name = "started_at", nullable = false) private LocalDateTime startedAt;
    @Column(name = "last_active_at", nullable = false) private LocalDateTime lastActiveAt;
    @Column(name = "ended_at") private LocalDateTime endedAt;
    @Column(name = "dwell_time_sec", nullable = false) private Integer dwellTimeSec;
    @Column(name = "max_scroll_pct", precision = 5, scale = 2) private BigDecimal maxScrollPct;
    @Column(name = "completed", nullable = false) private Boolean completed;
}
