package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fpt.swp391.nutribot.config.CorrelationIdFilter;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.filter.GuestRateLimitFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Service
public class ChatbotGatewayService {

    private static final int MAX_MESSAGE_LENGTH = 2_000;
    private static final int MAX_SESSION_ID_LENGTH = 100;
    private static final JsonMapper JSON_MAPPER = JsonMapper.shared();

    private static final int CB_FAILURE_THRESHOLD = 3;
    private static final Duration CB_WINDOW = Duration.ofSeconds(30);
    private static final Duration CB_COOLDOWN = Duration.ofSeconds(30);

    private final RestClient aiClient;
    private final GuestRateLimitFilter rateLimitFilter;

    private volatile CircuitState circuitState = CircuitState.CLOSED;
    private int failureCount;
    private Instant failureWindowStart;
    private Instant lastFailureAt;
    private final Object cbLock = new Object();

    public ChatbotGatewayService(
            @Value("${ai-service.base-url:http://localhost:8000}") String aiServiceBaseUrl,
            GuestRateLimitFilter rateLimitFilter) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(3));
        requestFactory.setReadTimeout(Duration.ofSeconds(35));

        this.aiClient = RestClient.builder()
                .baseUrl(aiServiceBaseUrl.replaceAll("/$", ""))
                .requestFactory(requestFactory)
                .build();
        this.rateLimitFilter = rateLimitFilter;
    }

    public ChatbotReply getReply(
            HttpServletRequest httpRequest,
            String sessionId,
            String message,
            boolean guest,
            Map<String, Object> userContext,
            List<ConversationTurn> conversationHistory) {
        validateRequest(sessionId, message);

        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        String quotaKey = guest ? (String) httpRequest.getAttribute("guestQuotaKey") : null;
        log.info("[{}] Gateway: sessionId={}, msgLen={}, guest={}, contextKeys={}",
                correlationId,
                sessionId.length() > 8 ? sessionId.substring(0, 8) + "..." : sessionId,
                message.length(),
                guest,
                userContext == null ? 0 : userContext.size());

        if (!canAttemptAiCall()) {
            if (quotaKey != null) rateLimitFilter.releaseReservedTurn(quotaKey);
            log.warn("[{}] Gateway: circuit OPEN, returning fallback immediately", correlationId);
            return fallback(quotaKey, guest, correlationId);
        }

        try {
            Map<String, Object> aiRequest = new LinkedHashMap<>();
            aiRequest.put("message", message.trim());
            aiRequest.put("session_id", sessionId);
            aiRequest.put("user_context", userContext);
            aiRequest.put("conversation_history", toAiHistory(conversationHistory));
            String requestBody = JSON_MAPPER.writeValueAsString(aiRequest);

            AiChatResponse response = aiClient.post()
                    .uri("/api/ai/chat")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody.getBytes(StandardCharsets.UTF_8))
                    .retrieve()
                    .body(AiChatResponse.class);

            if (response == null || response.reply() == null || response.reply().isBlank()) {
                throw new RestClientException("AI service returned an empty reply.");
            }

            recordAiSuccess();
            if (quotaKey != null) rateLimitFilter.consumeReservedTurn(quotaKey);
            Integer remaining = guest ? rateLimitFilter.remainingForKey(quotaKey) : null;
            log.info("[{}] Gateway: AI success, replyLen={}", correlationId, response.reply().length());
            return new ChatbotReply(response.reply(), safeRecommendations(response.recommendations()), remaining, false);
        } catch (RestClientException exception) {
            recordAiFailure();
            if (quotaKey != null) rateLimitFilter.releaseReservedTurn(quotaKey);
            log.warn("[{}] Gateway: AI call failed, returning fallback: {}", correlationId, exception.getMessage());
            return fallback(quotaKey, guest, correlationId);
        }
    }

    private boolean canAttemptAiCall() {
        Instant now = Instant.now();
        synchronized (cbLock) {
            if (circuitState == CircuitState.CLOSED) {
                if (failureWindowStart != null && failureWindowStart.plus(CB_WINDOW).isBefore(now)) {
                    failureCount = 0;
                    failureWindowStart = now;
                }
                return true;
            }
            if (circuitState == CircuitState.OPEN) {
                if (lastFailureAt != null && lastFailureAt.plus(CB_COOLDOWN).isBefore(now)) {
                    circuitState = CircuitState.HALF_OPEN;
                    log.info("Circuit transitioned OPEN -> HALF_OPEN");
                    return true;
                }
                return false;
            }
            return true;
        }
    }

    private void recordAiFailure() {
        synchronized (cbLock) {
            lastFailureAt = Instant.now();
            if (circuitState == CircuitState.HALF_OPEN) {
                circuitState = CircuitState.OPEN;
                log.info("Circuit transitioned HALF_OPEN -> OPEN (probe failed)");
                return;
            }
            if (failureWindowStart == null || failureWindowStart.plus(CB_WINDOW).isBefore(lastFailureAt)) {
                failureCount = 1;
                failureWindowStart = lastFailureAt;
            } else {
                failureCount++;
            }
            if (failureCount >= CB_FAILURE_THRESHOLD) {
                circuitState = CircuitState.OPEN;
                log.info("Circuit transitioned CLOSED -> OPEN ({} failures in {}s)", failureCount, CB_WINDOW.getSeconds());
            }
        }
    }

    private void recordAiSuccess() {
        synchronized (cbLock) {
            if (circuitState == CircuitState.HALF_OPEN) {
                circuitState = CircuitState.CLOSED;
                failureCount = 0;
                log.info("Circuit transitioned HALF_OPEN -> CLOSED (probe succeeded)");
            }
        }
    }

    private ChatbotReply fallback(String quotaKey, boolean guest, String correlationId) {
        Integer remaining = guest && quotaKey != null ? rateLimitFilter.remainingForKey(quotaKey) : null;
        return new ChatbotReply(
                "NutriBot is temporarily unavailable. Please try again shortly.",
                List.of(),
                remaining,
                true);
    }

    private void validateRequest(String sessionId, String message) {
        if (sessionId == null || sessionId.isBlank() || sessionId.length() > MAX_SESSION_ID_LENGTH) {
            throw new BadRequestException("A session ID between 1 and 100 characters is required.");
        }
        if (message == null || message.isBlank() || message.length() > MAX_MESSAGE_LENGTH) {
            throw new BadRequestException("Message must contain between 1 and 2000 characters.");
        }
    }

    private List<String> safeRecommendations(List<String> recommendations) {
        return recommendations == null ? List.of() : recommendations.stream()
                .filter(value -> value != null && !value.isBlank())
                .limit(3)
                .toList();
    }

    private List<Map<String, String>> toAiHistory(List<ConversationTurn> conversationHistory) {
        if (conversationHistory == null) return List.of();
        return conversationHistory.stream()
                .map(turn -> Map.of("sender", turn.sender(), "content", turn.content()))
                .toList();
    }

    public record ConversationTurn(
            @NotBlank @Pattern(regexp = "USER|ASSISTANT") String sender,
            @NotBlank @Size(max = 2_000) String content) { }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ChatbotReply(
            String reply,
            List<String> recommendations,
            Integer remainingTrialCount,
            boolean fallback) { }

    public record AiChatResponse(String reply, List<String> recommendations) { }

    private enum CircuitState { CLOSED, OPEN, HALF_OPEN }
}
