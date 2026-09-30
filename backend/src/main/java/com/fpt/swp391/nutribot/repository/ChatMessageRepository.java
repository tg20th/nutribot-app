package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Integer> {
    List<ChatMessage> findBySessionSessionIdOrderByCreatedAtAsc(Integer sessionId);
    Page<ChatMessage> findBySessionSessionIdOrderByCreatedAtAsc(Integer sessionId, Pageable pageable);
    Optional<ChatMessage> findByIdempotencyKey(String idempotencyKey);
}
