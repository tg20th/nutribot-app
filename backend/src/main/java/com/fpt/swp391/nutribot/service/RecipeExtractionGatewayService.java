package com.fpt.swp391.nutribot.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.entity.Content;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * NB-60: Gọi AI service để trích xuất công thức có cấu trúc từ nội dung đã publish.
 * Lỗi kết nối/không trích xuất được đều trả về null để phía nghiệp vụ bỏ qua an toàn.
 */
@Slf4j
@Service
public class RecipeExtractionGatewayService {

    private final RestClient aiClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RecipeExtractionGatewayService(
            @Value("${ai-service.base-url:http://localhost:8000}") String aiServiceBaseUrl,
            @Value("${ai-service.extraction-timeout-seconds:40}") long extractionTimeoutSeconds) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(Math.max(5, extractionTimeoutSeconds)));

        this.aiClient = RestClient.builder()
                .baseUrl(aiServiceBaseUrl.replaceAll("/$", ""))
                .requestFactory(requestFactory)
                .build();
    }

    public RecipeExtractionResult extractRecipe(Content content) {
        if (content == null) {
            return null;
        }
        try {
            Map<String, Object> request = new LinkedHashMap<>();
            request.put("content_id", content.getContentId() != null && content.getContentId() > 0 ? content.getContentId() : 1);
            request.put("content_type", content.getContentType() != null && content.getContentType().equalsIgnoreCase("VIDEO") ? "VIDEO" : "BLOG");
            request.put("title", content.getTitle() != null && !content.getTitle().isBlank() ? content.getTitle() : "Chưa có tiêu đề");
            request.put("body", content.getBody() != null ? content.getBody() : "");

            String requestBody = objectMapper.writeValueAsString(request);

            AiExtractionEnvelope response = aiClient.post()
                    .uri("/api/ai/extract-recipe")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody.getBytes(StandardCharsets.UTF_8))
                    .retrieve()
                    .body(AiExtractionEnvelope.class);

            if (response == null || response.data() == null) {
                log.warn("AI recipe extraction trả về rỗng cho content {}", content.getContentId());
                return null;
            }
            return response.data();
        } catch (RestClientException ex) {
            log.error("Gọi AI recipe extraction thất bại cho content {}: {}", content.getContentId(), ex.getMessage());
            return null;
        } catch (Exception ex) {
            log.error("Lỗi không mong đợi khi trích xuất công thức cho content {}: {}", content.getContentId(), ex.getMessage());
            return null;
        }
    }

    public record RecipeExtractionResult(
            DishProposal dish,
            NutritionProposal nutrition,
            List<IngredientProposal> ingredients,
            RecipeProposal recipe
    ) {}

    public record DishProposal(
            String name,
            String description,
            @JsonProperty("serving_size") BigDecimal servingSize,
            @JsonProperty("serving_unit") String servingUnit
    ) {}

    public record NutritionProposal(
            Integer calories,
            @JsonProperty("protein_g") BigDecimal proteinG,
            @JsonProperty("carbs_g") BigDecimal carbsG,
            @JsonProperty("fat_g") BigDecimal fatG,
            @JsonProperty("fiber_g") BigDecimal fiberG
    ) {}

    public record IngredientProposal(
            String name,
            BigDecimal quantity,
            String unit,
            String notes
    ) {}

    public record RecipeProposal(
            String title,
            String description,
            @JsonProperty("prep_time_min") Integer prepTimeMin,
            @JsonProperty("cook_time_min") Integer cookTimeMin,
            Integer servings,
            List<String> steps
    ) {}

    private record AiExtractionEnvelope(
            Boolean success,
            String message,
            RecipeExtractionResult data
    ) {}
}
