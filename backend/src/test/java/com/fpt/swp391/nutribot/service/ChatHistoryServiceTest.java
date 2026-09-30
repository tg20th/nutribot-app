package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.ChatMessageCreateRequest;
import com.fpt.swp391.nutribot.dto.response.ChatMessageResponse;
import com.fpt.swp391.nutribot.dto.response.ChatSessionResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.ChatMessage;
import com.fpt.swp391.nutribot.entity.ChatSession;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.ChatMessageRepository;
import com.fpt.swp391.nutribot.repository.ChatSessionRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("Kiểm thử ChatHistoryService - NB-49 Chat Persistence")
class ChatHistoryServiceTest {

    private ChatSessionRepository sessionRepository;
    private ChatMessageRepository messageRepository;
    private UserRepository userRepository;
    private ChatHistoryService chatHistoryService;

    private User testUser;

    @BeforeEach
    void setUp() {
        sessionRepository = mock(ChatSessionRepository.class);
        messageRepository = mock(ChatMessageRepository.class);
        userRepository = mock(UserRepository.class);
        chatHistoryService = new ChatHistoryService(sessionRepository, messageRepository, userRepository);

        testUser = User.builder()
                .userId(1)
                .username("testuser")
                .status(AccountStatus.ACTIVE)
                .build();
    }

    private ChatSession session(int id, String title) {
        return ChatSession.builder()
                .sessionId(id)
                .user(testUser)
                .title(title)
                .status("member_active")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    private ChatMessage message(int id, ChatSession s, String senderType, String content) {
        return ChatMessage.builder()
                .messageId(id)
                .session(s)
                .senderType(senderType)
                .content(content)
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("Tạo session mới cho user")
    void createSession_newUser_createsSession() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(sessionRepository.save(any(ChatSession.class))).thenAnswer(inv -> {
            ChatSession s = inv.getArgument(0);
            s.setSessionId(10);
            return s;
        });

        ChatSessionResponse result = chatHistoryService.createSession("testuser");

        assertEquals(10, result.getSessionId());
        assertEquals("Cuộc trò chuyện mới", result.getTitle());
        verify(sessionRepository).save(any(ChatSession.class));
    }

    @Test
    @DisplayName("Xóa session thì cascade xóa messages")
    void deleteSession_validOwner_deletes() {
        ChatSession s = session(5, "Test");
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(sessionRepository.findBySessionIdAndUserUserId(5, 1)).thenReturn(Optional.of(s));

        chatHistoryService.deleteSession("testuser", 5);

        verify(sessionRepository).delete(s);
    }

    @Test
    @DisplayName("Xóa session khác user thì throw NotFoundException")
    void deleteSession_otherUser_throwsNotFound() {
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(sessionRepository.findBySessionIdAndUserUserId(99, 1)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class,
                () -> chatHistoryService.deleteSession("testuser", 99));
    }

    @Test
    @DisplayName("Pagination: trả đúng số message theo page/size")
    void getMessagesPaged_validOwner_returnsPage() {
        ChatSession s = session(5, "Test");
        List<ChatMessage> messages = List.of(
                message(1, s, "USER", "Hello"),
                message(2, s, "ASSISTANT", "Hi there")
        );
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(sessionRepository.findBySessionIdAndUserUserId(5, 1)).thenReturn(Optional.of(s));
        when(messageRepository.findBySessionSessionIdOrderByCreatedAtAsc(eq(5), any(Pageable.class)))
                .thenReturn(new PageImpl<>(messages));

        PagedResponse<ChatMessageResponse> result = chatHistoryService.getMessagesPaged("testuser", 5, 0, 50);

        assertEquals(2, result.getContent().size());
        assertEquals(2, result.getTotalElements());
        assertEquals(0, result.getPage());
    }

    @Test
    @DisplayName("Pagination: size vượt quá 100 thì giới hạn ở 100")
    void getMessagesPaged_sizeOver100_limitsTo100() {
        ChatSession s = session(5, "Test");
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(sessionRepository.findBySessionIdAndUserUserId(5, 1)).thenReturn(Optional.of(s));
        when(messageRepository.findBySessionSessionIdOrderByCreatedAtAsc(eq(5), argThat(pageable ->
                pageable.getPageSize() == 100 && pageable.getPageNumber() == 0)))
                .thenReturn(new PageImpl<>(List.of()));

        chatHistoryService.getMessagesPaged("testuser", 5, 0, 500);

        verify(messageRepository).findBySessionSessionIdOrderByCreatedAtAsc(eq(5), argThat(pageable ->
                pageable.getPageSize() == 100));
    }

    @Test
    @DisplayName("Pagination: page âm thì mặc định page 0")
    void getMessagesPaged_negativePage_defaultsToZero() {
        ChatSession s = session(5, "Test");
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(sessionRepository.findBySessionIdAndUserUserId(5, 1)).thenReturn(Optional.of(s));
        when(messageRepository.findBySessionSessionIdOrderByCreatedAtAsc(eq(5), argThat(pageable ->
                pageable.getPageNumber() == 0)))
                .thenReturn(new PageImpl<>(List.of()));

        chatHistoryService.getMessagesPaged("testuser", 5, -5, 50);

        verify(messageRepository).findBySessionSessionIdOrderByCreatedAtAsc(eq(5), argThat(pageable ->
                pageable.getPageNumber() == 0));
    }

    @Test
    @DisplayName("Lưu message với idempotencyKey")
    void addMessage_withIdempotencyKey_savesKey() {
        ChatSession s = session(5, "Test");
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(sessionRepository.findBySessionIdAndUserUserId(5, 1)).thenReturn(Optional.of(s));
        when(messageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> {
            ChatMessage m = inv.getArgument(0);
            m.setMessageId(99);
            m.setCreatedAt(LocalDateTime.now());
            return m;
        });

        ChatMessageCreateRequest request = new ChatMessageCreateRequest();
        request.setSenderType("USER");
        request.setContent("Hello");
        request.setIdempotencyKey("client-uuid-123");

        ChatMessageResponse result = chatHistoryService.addMessage("testuser", 5, request);

        assertEquals(99, result.getMessageId());
        verify(messageRepository).save(argThat(m -> "client-uuid-123".equals(m.getIdempotencyKey())));
    }

    @Test
    @DisplayName("Idempotency key ngắn title từ message đầu tiên")
    void addMessage_firstMessage_updatesSessionTitle() {
        ChatSession s = session(5, "Cuộc trò chuyện mới");
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
        when(sessionRepository.findBySessionIdAndUserUserId(5, 1)).thenReturn(Optional.of(s));
        when(messageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> {
            ChatMessage m = inv.getArgument(0);
            m.setMessageId(1);
            m.setCreatedAt(LocalDateTime.now());
            return m;
        });

        ChatMessageCreateRequest request = new ChatMessageCreateRequest();
        request.setSenderType("USER");
        request.setContent("Tôi muốn giảm cân");

        chatHistoryService.addMessage("testuser", 5, request);

        verify(sessionRepository).save(argThat(session -> "Tôi muốn giảm cân".equals(session.getTitle())));
    }
}
