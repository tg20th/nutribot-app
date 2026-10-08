package com.fpt.swp391.nutribot.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Service
public class ContentModerationGatewayService {

    private final RestClient aiClient;

    public ContentModerationGatewayService(
            @Value("${ai-service.base-url:http://localhost:8000}") String aiServiceBaseUrl) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(30));

        this.aiClient = RestClient.builder()
                .baseUrl(aiServiceBaseUrl.replaceAll("/$", ""))
                .requestFactory(requestFactory)
                .build();
    }

    /**
     * Calls AI moderation endpoint and returns the moderation decision.
     *
     * @param contentId   Content ID (> 0)
     * @param contentType Content type ("BLOG" or "VIDEO")
     * @param title       Content title
     * @param description Content description/intro
     * @param body        Full body content
     * @param category    Category name
     * @param tags        List of tags
     * @return ModerationResult containing decision and details
     */
    public ModerationResult moderateContent(
            Integer contentId,
            String contentType,
            String title,
            String description,
            String body,
            String category,
            java.util.List<String> tags) {
        try {
            Map<String, Object> request = new LinkedHashMap<>();
            request.put("content_id", contentId != null && contentId > 0 ? contentId : 1);
            request.put("content_type", contentType != null && contentType.equalsIgnoreCase("VIDEO") ? "VIDEO" : "BLOG");
            request.put("title", title != null && !title.isBlank() ? title : "Chưa có tiêu đề");
            request.put("description", description != null ? description : "");
            request.put("body", body != null ? body : "");
            request.put("category", category != null ? category : "");
            request.put("tags", tags != null ? tags : java.util.List.of());

            String requestBody = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(request);

            AiModerationResponse response = aiClient.post()
                    .uri("/api/ai/moderate-content")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody.getBytes(StandardCharsets.UTF_8))
                    .retrieve()
                    .body(AiModerationResponse.class);

            if (response == null) {
                log.warn("AI moderation returned null response, defaulting to NEEDS_REVIEW");
                return new ModerationResult("NEEDS_REVIEW", "AI service returned empty response", 0.0, java.util.List.of());
            }

            return new ModerationResult(
                    response.decision() != null ? response.decision() : "NEEDS_REVIEW",
                    response.reason() != null ? response.reason() : "No reason provided",
                    response.confidence() != null ? response.confidence() : 0.0,
                    response.categories() != null ? response.categories() : java.util.List.of()
            );
        } catch (RestClientException ex) {
            log.error("AI moderation call failed: {}", ex.getMessage());
            return new ModerationResult("NEEDS_REVIEW", "AI service unavailable, manual review required", 0.0, java.util.List.of("AI_UNAVAILABLE"));
        } catch (Exception ex) {
            log.error("Unexpected error during AI moderation: {}", ex.getMessage());
            return new ModerationResult("NEEDS_REVIEW", "Moderation error, manual review required", 0.0, java.util.List.of("ERROR"));
        }
    }

    public record ModerationResult(
            String decision,      // APPROVE, REJECT, NEEDS_REVIEW
            String reason,
            Double confidence,
            java.util.List<String> categories
    ) {}

    private record AiModerationResponse(
            String decision,
            String reason,
            Double confidence,
            java.util.List<String> categories
    ) {}
}
