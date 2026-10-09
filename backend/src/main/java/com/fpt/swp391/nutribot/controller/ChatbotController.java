package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.ChatMessageCreateRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.ChatMessageResponse;
import com.fpt.swp391.nutribot.dto.response.ChatSessionResponse;
import com.fpt.swp391.nutribot.dto.response.HealthProfileResponse;
import com.fpt.swp391.nutribot.entity.ChatMessage;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.repository.ChatMessageRepository;
import com.fpt.swp391.nutribot.service.ChatHistoryService;
import com.fpt.swp391.nutribot.service.ChatbotGatewayService;
import com.fpt.swp391.nutribot.service.ChatbotGatewayService.ConversationTurn;
import com.fpt.swp391.nutribot.service.ChatbotHealthProfileCache;
import com.fpt.swp391.nutribot.service.ChatbotIntentRouter;
import lombok.extern.slf4j.Slf4j;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/chatbot")
@RequiredArgsConstructor
@Slf4j
public class ChatbotController {

    private static final int MAX_AI_HISTORY = 6;
    private static final int MAX_CONVERSATION_HISTORY = 50;

    private final ChatbotGatewayService chatbotGatewayService;
    private final ChatHistoryService chatHistoryService;
    private final ChatbotHealthProfileCache chatbotHealthProfileCache;
    private final ChatbotIntentRouter chatbotIntentRouter;
    private final ChatMessageRepository chatMessageRepository;

    @PostMapping("/query")
    public ResponseEntity<ApiResponse<ChatbotQueryResponse>> query(
            HttpServletRequest httpRequest,
            Authentication authentication,
            @Valid @RequestBody ChatbotQueryRequest request) {
        boolean guest = isGuest(authentication);
        if (guest && (request.sessionId() == null || request.sessionId().isBlank())) {
            throw new BadRequestException("A guest session ID is required.");
        }

        Integer memberSessionId = null;
        List<ChatbotGatewayService.ConversationTurn> history = request.conversationHistory() == null
                ? List.of()
                : request.conversationHistory();
        Map<String, Object> userContext = null;
        HealthProfileResponse profile = null;

        if (!guest) {
            String username = authentication.getName();
            memberSessionId = findOrCreateMemberSession(username, request.sessionId());

            if (request.idempotencyKey() != null && !request.idempotencyKey().isBlank()) {
                var existing = chatMessageRepository.findByIdempotencyKey(request.idempotencyKey());
                if (existing.isPresent()) {
                    ChatMessage m = existing.get();
                    return ResponseEntity.ok(ApiResponse.success("Success",
                            new ChatbotQueryResponse(memberSessionId, m.getSenderType(), m.getContent(), m.getCreatedAt(),
                                    m.getContent(), List.of(), null, false)));
                }
            }

            history = loadMemberHistory(username, memberSessionId);
            profile = chatbotHealthProfileCache.get(username);
            userContext = toHealthContext(profile);
            saveMessage(username, memberSessionId, "USER", request.message(), request.idempotencyKey());
        }

        String aiSessionId = guest ? request.sessionId() : memberSessionId.toString();
        Optional<String> fastReply = chatbotIntentRouter.route(request.message(), profile, guest);
        ChatbotGatewayService.ChatbotReply reply;
        if (fastReply.isPresent()) {
            reply = chatbotGatewayService.completeFastPath(httpRequest, guest, fastReply.get());
        } else {
            reply = chatbotGatewayService.getReply(
                    httpRequest, aiSessionId, request.message(), guest, userContext, history);
        }
        log.info("Chatbot route={}", fastReply.isPresent() ? "FAST" : "AI");

        String assistantContent = toStoredAssistantContent(reply);
        LocalDateTime createdAt = null;
        if (!guest) {
            ChatMessageResponse savedReply = saveMessage(
                    username(authentication), memberSessionId, "ASSISTANT", assistantContent, null);
            createdAt = savedReply.getCreatedAt();
        }

        return ResponseEntity.ok(ApiResponse.success(
                "Success",
                new ChatbotQueryResponse(
                        memberSessionId,
                        "ASSISTANT",
                        assistantContent,
                        createdAt,
                        reply.reply(),
                        reply.recommendations(),
                        reply.remainingTrialCount(),
                        reply.fallback())));
    }

    private Integer findOrCreateMemberSession(String username, String requestedSessionId) {
        if (requestedSessionId == null || requestedSessionId.isBlank()) {
            ChatSessionResponse session = chatHistoryService.createSession(username);
            return session.getSessionId();
        }
        try {
            return Integer.valueOf(requestedSessionId);
        } catch (NumberFormatException exception) {
            throw new BadRequestException("A member session ID must be a valid number.");
        }
    }

    private List<ChatbotGatewayService.ConversationTurn> loadMemberHistory(String username, Integer sessionId) {
        List<ChatMessageResponse> messages = chatHistoryService.getMessages(username, sessionId);
        int start = Math.max(0, messages.size() - MAX_AI_HISTORY);
        return messages.subList(start, messages.size()).stream()
                .map(message -> new ChatbotGatewayService.ConversationTurn(
                        message.getSenderType(), message.getContent()))
                .toList();
    }

    private Map<String, Object> toHealthContext(HealthProfileResponse profile) {
        Map<String, Object> context = new HashMap<>();
        if (profile.bmi() != null) context.put("bmi", profile.bmi());
        if (profile.allergies() != null && !profile.allergies().isEmpty()) context.put("allergies", profile.allergies());
        if (profile.vegetarianType() != null && !profile.vegetarianType().isBlank()) context.put("vegetarian_type", profile.vegetarianType());
        if (profile.healthGoal() != null && !profile.healthGoal().isBlank()) context.put("health_goal", profile.healthGoal());
        return context;
    }

    private ChatMessageResponse saveMessage(String username, Integer sessionId, String senderType, String content, String idempotencyKey) {
        ChatMessageCreateRequest request = new ChatMessageCreateRequest();
        request.setSenderType(senderType);
        request.setContent(content);
        request.setIdempotencyKey(idempotencyKey);
        return chatHistoryService.addMessage(username, sessionId, request);
    }

    private String toStoredAssistantContent(ChatbotGatewayService.ChatbotReply reply) {
        if (reply.recommendations().isEmpty()) return reply.reply();
        return reply.reply() + "\n\nQuick suggestions:\n- " + String.join("\n- ", reply.recommendations());
    }

    private boolean isGuest(Authentication authentication) {
        return authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken;
    }

    private String username(Authentication authentication) {
        return authentication.getName();
    }

    public record ChatbotQueryRequest(
            @Size(max = 100, message = "Session ID cannot exceed 100 characters.") String sessionId,
            @jakarta.validation.constraints.NotBlank(message = "Message is required.")
            @Size(max = 2_000, message = "Message cannot exceed 2000 characters.") String message,
            @Size(max = MAX_CONVERSATION_HISTORY, message = "Conversation history cannot exceed 50 messages.")
            List<@Valid ConversationTurn> conversationHistory,
            @Size(max = 100, message = "Idempotency key cannot exceed 100 characters.") String idempotencyKey) { }

    public record ChatbotQueryResponse(
            Integer sessionId,
            String senderType,
            String content,
            LocalDateTime createdAt,
            String reply,
            List<String> recommendations,
            Integer remainingTrialCount,
            boolean fallback) { }
}
