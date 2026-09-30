package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.ChatMessageCreateRequest;
import com.fpt.swp391.nutribot.dto.response.*;
import com.fpt.swp391.nutribot.entity.*;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service @RequiredArgsConstructor
public class ChatHistoryService {
    private final ChatSessionRepository sessionRepository;
    private final ChatMessageRepository messageRepository;
    private final UserRepository userRepository;

    @Transactional public ChatSessionResponse createSession(String username) {
        User user = userRepository.findByUsername(username).orElseThrow(() -> new NotFoundException("Người dùng không tồn tại"));
        ChatSession session = sessionRepository.save(ChatSession.builder().user(user).title("Cuộc trò chuyện mới").build());
        return toSession(session, null, 0);
    }

    @Transactional(readOnly = true) public List<ChatSessionResponse> getSessions(String username) {
        User user = userRepository.findByUsername(username).orElseThrow(() -> new NotFoundException("Người dùng không tồn tại"));
        return sessionRepository.findByUserUserIdOrderByUpdatedAtDesc(user.getUserId()).stream().map(session -> {
            List<ChatMessage> messages = messageRepository.findBySessionSessionIdOrderByCreatedAtAsc(session.getSessionId());
            ChatMessage latest = messages.isEmpty() ? null : messages.get(messages.size() - 1);
            return toSession(session, latest, messages.size());
        }).toList();
    }

    @Transactional(readOnly = true) public List<ChatMessageResponse> getMessages(String username, Integer sessionId) {
        ChatSession session = ownedSession(username, sessionId);
        return messageRepository.findBySessionSessionIdOrderByCreatedAtAsc(session.getSessionId()).stream().map(this::toMessage).toList();
    }

    @Transactional(readOnly = true) public PagedResponse<ChatMessageResponse> getMessagesPaged(String username, Integer sessionId, int page, int size) {
        ChatSession session = ownedSession(username, sessionId);
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        Pageable pageable = PageRequest.of(safePage, safeSize);
        Page<ChatMessage> msgPage = messageRepository.findBySessionSessionIdOrderByCreatedAtAsc(session.getSessionId(), pageable);
        List<ChatMessageResponse> content = msgPage.getContent().stream().map(this::toMessage).toList();
        return PagedResponse.<ChatMessageResponse>builder()
                .content(content)
                .page(msgPage.getNumber())
                .size(msgPage.getSize())
                .totalElements(msgPage.getTotalElements())
                .totalPages(msgPage.getTotalPages())
                .first(msgPage.isFirst())
                .last(msgPage.isLast())
                .build();
    }

    @Transactional public ChatMessageResponse addMessage(String username, Integer sessionId, ChatMessageCreateRequest request) {
        ChatSession session = ownedSession(username, sessionId);
        ChatMessage message = messageRepository.save(ChatMessage.builder()
                .session(session)
                .senderType(request.getSenderType())
                .content(request.getContent().trim())
                .idempotencyKey(request.getIdempotencyKey())
                .build());
        if ("Cuộc trò chuyện mới".equals(session.getTitle()) && "USER".equals(request.getSenderType())) {
            session.setTitle(shortTitle(message.getContent()));
        }
        sessionRepository.save(session);
        return toMessage(message);
    }

    @Transactional public void deleteSession(String username, Integer sessionId) {
        ChatSession session = ownedSession(username, sessionId);
        sessionRepository.delete(session);
    }

    private ChatSession ownedSession(String username, Integer id) {
        User user = userRepository.findByUsername(username).orElseThrow(() -> new NotFoundException("Người dùng không tồn tại"));
        return sessionRepository.findBySessionIdAndUserUserId(id, user.getUserId())
                .orElseThrow(() -> new NotFoundException("Không tìm thấy cuộc trò chuyện"));
    }

    private ChatSessionResponse toSession(ChatSession s, ChatMessage latest, long count) {
        return ChatSessionResponse.builder()
                .sessionId(s.getSessionId())
                .title(s.getTitle())
                .preview(latest == null ? "" : latest.getContent())
                .messageCount(count)
                .updatedAt(s.getUpdatedAt())
                .build();
    }

    private ChatMessageResponse toMessage(ChatMessage m) {
        return ChatMessageResponse.builder()
                .messageId(m.getMessageId())
                .senderType(m.getSenderType())
                .content(m.getContent())
                .createdAt(m.getCreatedAt())
                .build();
    }

    private String shortTitle(String value) {
        return value.length() <= 70 ? value : value.substring(0, 67).stripTrailing() + "...";
    }
}
