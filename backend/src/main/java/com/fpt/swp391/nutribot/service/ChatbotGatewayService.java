package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class ChatbotGatewayService {

    private static final int GUEST_TRIAL_LIMIT = 3;
    private static final int MAX_MESSAGE_LENGTH = 2_000;
    private static final int MAX_SESSION_ID_LENGTH = 100;
    private static final Duration GUEST_QUOTA_TTL = Duration.ofHours(24);

    private final RestClient aiClient;
    private final ConcurrentHashMap<String, GuestQuota> guestQuotas = new ConcurrentHashMap<>();

    public ChatbotGatewayService(
            @Value("${ai.service.base-url:http://localhost:8000}") String aiServiceBaseUrl) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(35));

        this.aiClient = RestClient.builder()
                .baseUrl(aiServiceBaseUrl.replaceAll("/$", ""))
                .requestFactory(requestFactory)
                .build();
    }

    public ChatbotReply getReply(
            String sessionId,
            String message,
            boolean guest,
            Map<String, Object> userContext,
            List<ConversationTurn> conversationHistory) {
        validateRequest(sessionId, message);

        GuestQuota quota = guest ? reserveGuestTurn(sessionId) : null;
        try {
            AiChatResponse response = aiClient.post()
                    .uri("/api/ai/chat")
                    .body(new AiChatRequest(
                            message.trim(),
                            sessionId,
                            userContext,
                            conversationHistory == null ? List.of() : conversationHistory))
                    .retrieve()
                    .body(AiChatResponse.class);

            if (response == null || response.reply() == null || response.reply().isBlank()) {
                throw new RestClientException("AI service returned an empty reply.");
            }

            if (quota != null) quota.consumeReservedTurn();
            Integer remaining = guest ? quota.remaining() : null;
            return new ChatbotReply(response.reply(), safeRecommendations(response.recommendations()), remaining, false);
        } catch (RestClientException exception) {
            if (quota != null) quota.releaseReservedTurn();
            log.warn("AI service request failed; returning the temporary fallback response.", exception);
            Integer remaining = guest ? quota.remaining() : null;
            return new ChatbotReply(
                    "NutriBot is temporarily unavailable. Please try again shortly.",
                    List.of(),
                    remaining,
                    true);
        }
    }

    private void validateRequest(String sessionId, String message) {
        if (sessionId == null || sessionId.isBlank() || sessionId.length() > MAX_SESSION_ID_LENGTH) {
            throw new BadRequestException("A session ID between 1 and 100 characters is required.");
        }
        if (message == null || message.isBlank() || message.length() > MAX_MESSAGE_LENGTH) {
            throw new BadRequestException("Message must contain between 1 and 2000 characters.");
        }
    }

    private GuestQuota reserveGuestTurn(String guestId) {
        purgeExpiredQuotas();
        GuestQuota quota = guestQuotas.computeIfAbsent(guestId, ignored -> new GuestQuota());
        synchronized (quota) {
            quota.lastAccess = Instant.now();
            if (quota.consumed + quota.reserved >= GUEST_TRIAL_LIMIT) {
                throw new GuestQuotaExceededException("Guest users can ask up to three questions.");
            }
            quota.reserved++;
            return quota;
        }
    }

    private void purgeExpiredQuotas() {
        Instant expiredBefore = Instant.now().minus(GUEST_QUOTA_TTL);
        guestQuotas.entrySet().removeIf(entry -> {
            GuestQuota quota = entry.getValue();
            synchronized (quota) {
                return quota.reserved == 0 && quota.lastAccess.isBefore(expiredBefore);
            }
        });
    }

    private List<String> safeRecommendations(List<String> recommendations) {
        return recommendations == null ? List.of() : recommendations.stream()
                .filter(value -> value != null && !value.isBlank())
                .limit(3)
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

    public static class GuestQuotaExceededException extends RuntimeException {
        public GuestQuotaExceededException(String message) {
            super(message);
        }
    }

    private record AiChatRequest(
            @JsonProperty("message") String message,
            @JsonProperty("session_id") String sessionId,
            @JsonProperty("user_context") Map<String, Object> userContext,
            @JsonProperty("conversation_history") List<ConversationTurn> conversationHistory) { }

    private record AiChatResponse(String reply, List<String> recommendations) { }

    private static final class GuestQuota {
        private int consumed;
        private int reserved;
        private Instant lastAccess = Instant.now();

        private synchronized int remaining() {
            return GUEST_TRIAL_LIMIT - consumed - reserved;
        }

        private synchronized void releaseReservedTurn() {
            if (reserved > 0) reserved--;
        }

        private synchronized void consumeReservedTurn() {
            if (reserved > 0) {
                reserved--;
                consumed++;
            }
        }
    }
}
