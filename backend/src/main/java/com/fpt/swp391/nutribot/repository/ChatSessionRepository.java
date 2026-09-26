package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.ChatSession;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ChatSessionRepository extends JpaRepository<ChatSession, Integer> {
    List<ChatSession> findByUserUserIdOrderByUpdatedAtDesc(Integer userId);
    Optional<ChatSession> findBySessionIdAndUserUserId(Integer sessionId, Integer userId);
}
