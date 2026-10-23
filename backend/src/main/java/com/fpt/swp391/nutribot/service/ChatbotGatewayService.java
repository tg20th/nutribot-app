package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fpt.swp391.nutribot.config.CorrelationIdFilter;
import com.fpt.swp391.nutribot.dto.request.ChatAttachmentRequest;
import com.fpt.swp391.nutribot.dto.response.ChatAttachmentResponse;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.AIQuotaExceededException;
import com.fpt.swp391.nutribot.exception.AIServiceProtocolException;
import com.fpt.swp391.nutribot.exception.AIServiceUnavailableException;
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
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
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
    private static final int MAX_AI_HISTORY = 6;
    private static final String HISTORY_TRUNCATION_MARKER = "\n[Earlier history truncated]";

    private final RestClient aiClient;
    private final GuestRateLimitFilter rateLimitFilter;

    private volatile CircuitState circuitState = CircuitState.CLOSED;
    private int failureCount;
    private Instant failureWindowStart;
    private Instant lastFailureAt;
    private boolean halfOpenProbeInFlight;
    private final Object cbLock = new Object();

    public ChatbotGatewayService(
            @Value("${ai-service.base-url:http://localhost:8000}") String aiServiceBaseUrl,
            @Value("${ai-service.chatbot-timeout-seconds:135}") long chatbotTimeoutSeconds,
            GuestRateLimitFilter rateLimitFilter) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(3));
        // Video analysis (URL or upload) can take up to 120s in the AI service,
        // so the shared gateway read deadline includes network overhead.
        requestFactory.setReadTimeout(Duration.ofSeconds(chatbotTimeoutSeconds));

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
            List<ConversationTurn> conversationHistory,
            ChatAttachmentRequest attachment) {
        validateRequest(sessionId, message);

        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        String quotaKey = guest ? (String) httpRequest.getAttribute("guestQuotaKey") : null;
        log.info("[{}] Gateway: sessionId={}, msgLen={}, guest={}, hasMedia={}, contextKeys={}",
                correlationId,
                sessionId.length() > 8 ? sessionId.substring(0, 8) + "..." : sessionId,
                message.length(),
                guest,
                attachment != null,
                userContext == null ? 0 : userContext.size());

        if (!canAttemptAiCall()) {
            if (quotaKey != null) rateLimitFilter.releaseReservedTurn(quotaKey);
            log.warn("[{}] Gateway: circuit OPEN, returning fallback immediately", correlationId);
            throw new AIServiceUnavailableException("AI is temporarily unavailable. Please try again later.");
        }

        Instant startedAt = Instant.now();
        try {
            Map<String, Object> aiRequest = new LinkedHashMap<>();
            aiRequest.put("message", message.trim());
            aiRequest.put("session_id", sessionId);
            aiRequest.put("user_context", userContext);
            aiRequest.put("conversation_history", toAiHistory(conversationHistory));
            appendAttachmentToAiRequest(aiRequest, attachment);
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
            log.info("[{}] Gateway: route=AI mediaType={} latencyMs={}", correlationId,
                    mediaType(attachment),
                    Duration.between(startedAt, Instant.now()).toMillis());

            ChatAttachmentResponse parsedAttachment = toAttachmentResponse(attachment, response);
            return new ChatbotReply(
                    response.reply(),
                    safeRecommendations(response.recommendations()),
                    remaining,
                    false,
                    parsedAttachment,
                    response.videoAnalysis(), response.videoSource(), response.videoSummary(), response.suggestedActions());
        } catch (RestClientException exception) {
            if (quotaKey != null) rateLimitFilter.releaseReservedTurn(quotaKey);
            String errorCode = exception instanceof RestClientResponseException responseException
                    ? String.valueOf(responseException.getStatusCode().value()) : exception.getClass().getSimpleName();
            log.warn("[{}] Gateway: route=AI mediaType={} errorCode={} latencyMs={}",
                    correlationId, mediaType(attachment), errorCode,
                    Duration.between(startedAt, Instant.now()).toMillis());
            if (exception instanceof RestClientResponseException responseException) {
                int status = responseException.getStatusCode().value();
                if (status == 429) {
                    releaseHalfOpenProbe();
                    throw new AIQuotaExceededException(
                        "AI is temporarily unavailable. We have reached the current AI usage limit. Please try again later.");
                }
                if (status == 400 || status == 401 || status == 403 || status == 422
                        || isInvalidResponsePayload(responseException)) {
                    releaseHalfOpenProbe();
                    throw new AIServiceProtocolException(
                            "The AI service rejected the chatbot request. Please try again.");
                }
            }
            if (!(exception instanceof RestClientResponseException)
                    && !(exception instanceof ResourceAccessException)) {
                releaseHalfOpenProbe();
                throw new AIServiceProtocolException(
                        "The AI service returned an invalid chatbot response. Please try again.");
            }
            if (isTransientFailure(exception)) {
                recordAiFailure();
            }
            if (!isTransientFailure(exception)) releaseHalfOpenProbe();
            throw new AIServiceUnavailableException(
                "AI is temporarily unavailable. Please try again later.");
        }
    }

    /** Completes a deterministic backend response while preserving guest quota semantics. */
    public ChatbotReply completeFastPath(HttpServletRequest httpRequest, boolean guest, String reply) {
        String quotaKey = guest ? (String) httpRequest.getAttribute("guestQuotaKey") : null;
        if (quotaKey != null) rateLimitFilter.consumeReservedTurn(quotaKey);
        Integer remaining = guest && quotaKey != null ? rateLimitFilter.remainingForKey(quotaKey) : null;
        return new ChatbotReply(reply, List.of(), remaining, false, null, null, null, null, List.of());
    }

    private void appendAttachmentToAiRequest(Map<String, Object> aiRequest, ChatAttachmentRequest attachment) {
        if (attachment == null) return;
        if ("IMAGE".equalsIgnoreCase(attachment.getType())) {
            Map<String, String> image = new LinkedHashMap<>();
            image.put("data_base64", attachment.getDataBase64());
            image.put("mime_type", attachment.getMimeType());
            aiRequest.put("image", image);
        } else if ("VIDEO".equalsIgnoreCase(attachment.getType())) {
            String url = attachment.getUrl();
            if (url != null && !url.isBlank()) {
                aiRequest.put("video_url", url.trim());
                return;
            }
            Map<String, String> video = new LinkedHashMap<>();
            video.put("data_base64", attachment.getDataBase64());
            video.put("mime_type", attachment.getMimeType());
            if (attachment.getFilename() != null) {
                video.put("filename", attachment.getFilename());
            }
            aiRequest.put("video", video);
        }
    }

    private String mediaType(ChatAttachmentRequest attachment) {
        if (attachment == null) return "TEXT";
        if (attachment.getUrl() != null && !attachment.getUrl().isBlank()) return "VIDEO_URL";
        return attachment.getType() == null ? "UNKNOWN" : attachment.getType().toUpperCase();
    }

    private ChatAttachmentResponse toAttachmentResponse(ChatAttachmentRequest sent, AiChatResponse ai) {
        if (sent == null) return null;
        String context = ai != null && ai.videoContext() != null
                ? ai.videoContext()
                : (ai != null ? ai.imageContext() : null);
        return ChatAttachmentResponse.builder()
                .type(sent.getType())
                .url(sent.getUrl())
                .mimeType(sent.getMimeType())
                .filename(sent.getFilename())
                .recognizedIngredients(ai != null ? ai.recognizedIngredients() : null)
                .uncertainIngredients(ai != null ? ai.uncertainIngredients() : null)
                .warnings(ai != null ? ai.warnings() : null)
                .imageContext(context)
                .build();
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
                    halfOpenProbeInFlight = true;
                    log.info("Circuit transitioned OPEN -> HALF_OPEN");
                    return true;
                }
                return false;
            }
            if (halfOpenProbeInFlight) return false;
            halfOpenProbeInFlight = true;
            return true;
        }
    }

    private void recordAiFailure() {
        synchronized (cbLock) {
            lastFailureAt = Instant.now();
            if (circuitState == CircuitState.HALF_OPEN) {
                circuitState = CircuitState.OPEN;
                halfOpenProbeInFlight = false;
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
                halfOpenProbeInFlight = false;
                failureCount = 0;
                log.info("Circuit transitioned HALF_OPEN -> CLOSED (probe succeeded)");
            }
        }
    }

    static boolean isTransientFailure(RestClientException exception) {
        if (exception instanceof ResourceAccessException) return true;
        if (!(exception instanceof RestClientResponseException responseException)) return false;
        int status = responseException.getStatusCode().value();
        return status == 408 || status == 425 || (status >= 500 && status <= 599);
    }

    private boolean isInvalidResponsePayload(RestClientResponseException exception) {
        return exception.getStatusCode().value() == 502
                && exception.getResponseBodyAsString().contains("AI_RESPONSE_INVALID");
    }

    private void releaseHalfOpenProbe() {
        synchronized (cbLock) {
            if (circuitState == CircuitState.HALF_OPEN) {
                circuitState = CircuitState.OPEN;
                halfOpenProbeInFlight = false;
                lastFailureAt = Instant.now();
            }
        }
    }

    private void validateRequest(String sessionId, String message) {
        if (sessionId == null || sessionId.isBlank() || sessionId.length() > MAX_SESSION_ID_LENGTH) {
            throw new BadRequestException("A session ID between 1 and 100 characters is required.");
        }
        if (message != null && message.length() > MAX_MESSAGE_LENGTH) {
            throw new BadRequestException("Message cannot exceed 2000 characters.");
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
        int start = Math.max(0, conversationHistory.size() - MAX_AI_HISTORY);
        return conversationHistory.subList(start, conversationHistory.size()).stream()
                .map(turn -> Map.of("sender", turn.sender(), "content", normalizeAiHistoryContent(turn.content())))
                .toList();
    }

    /**
     * Stored messages predate the current 2,000-character API contract. Keep
     * the turn and an explicit prefix, but never send an invalid AI payload.
     */
    static String normalizeAiHistoryContent(String content) {
        String normalized = content == null ? "" : content.strip();
        if (normalized.length() <= MAX_MESSAGE_LENGTH) return normalized;
        log.warn("AI history content exceeded contract; sender contentLength={} truncated=true",
                normalized.length());
        int prefixLength = MAX_MESSAGE_LENGTH - HISTORY_TRUNCATION_MARKER.length();
        return normalized.substring(0, prefixLength) + HISTORY_TRUNCATION_MARKER;
    }

    public record ConversationTurn(
            @NotBlank @Pattern(regexp = "USER|ASSISTANT") String sender,
            @NotBlank @Size(max = 2_000) String content) { }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ChatbotReply(
            String reply,
            List<String> recommendations,
            Integer remainingTrialCount,
            boolean fallback,
            ChatAttachmentResponse attachment,
            Map<String, Object> videoAnalysis,
            Map<String, Object> videoSource,
            String videoSummary,
            List<Map<String, Object>> suggestedActions) { }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AiChatResponse(
            String reply,
            List<String> recommendations,
            List<String> recognizedIngredients,
            List<String> uncertainIngredients,
            List<String> warnings,
            String imageContext,
            String videoContext,
            @com.fasterxml.jackson.annotation.JsonProperty("video_analysis") Map<String, Object> videoAnalysis,
            @com.fasterxml.jackson.annotation.JsonProperty("video_source") Map<String, Object> videoSource,
            @com.fasterxml.jackson.annotation.JsonProperty("video_summary") String videoSummary,
            @com.fasterxml.jackson.annotation.JsonProperty("suggested_actions") List<Map<String, Object>> suggestedActions) { }

    private enum CircuitState { CLOSED, OPEN, HALF_OPEN }
}
