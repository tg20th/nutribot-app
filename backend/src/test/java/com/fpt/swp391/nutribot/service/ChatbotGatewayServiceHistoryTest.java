package com.fpt.swp391.nutribot.service;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChatbotGatewayServiceHistoryTest {

    @Test
    void keepsCanonicalTextHistoryUnchanged() {
        String text = "{This is ordinary text, not a media envelope}";

        assertEquals(text, ChatbotGatewayService.normalizeAiHistoryContent(text));
    }

    @Test
    void boundsLegacyStoredHistoryToTheFastApiContractWithoutDroppingTheTurn() {
        String legacyContent = "nutrition advice ".repeat(200);

        String normalized = ChatbotGatewayService.normalizeAiHistoryContent(legacyContent);

        assertEquals(2_000, normalized.length());
        assertTrue(normalized.endsWith("[Earlier history truncated]"));
    }

    @Test
    void onlyTransientProviderOrNetworkFailuresAreCircuitBreakerFailures() {
        assertTrue(ChatbotGatewayService.isTransientFailure(
                HttpServerErrorException.create(HttpStatus.SERVICE_UNAVAILABLE, "", null, null, null)));
        assertTrue(ChatbotGatewayService.isTransientFailure(new ResourceAccessException("connect")));
        org.junit.jupiter.api.Assertions.assertFalse(ChatbotGatewayService.isTransientFailure(
                HttpClientErrorException.create(HttpStatus.UNPROCESSABLE_ENTITY, "", null, null, null)));
        org.junit.jupiter.api.Assertions.assertFalse(ChatbotGatewayService.isTransientFailure(
                HttpClientErrorException.create(HttpStatus.BAD_REQUEST, "", null, null, null)));
    }
}
