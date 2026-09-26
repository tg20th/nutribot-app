package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Integer> {
    List<ChatMessage> findBySessionSessionIdOrderByCreatedAtAsc(Integer sessionId);
}
