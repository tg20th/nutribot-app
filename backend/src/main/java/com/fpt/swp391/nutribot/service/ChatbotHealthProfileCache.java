package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.config.CacheConfig;
import com.fpt.swp391.nutribot.dto.response.HealthProfileResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;

/** Cache boundary for chatbot reads; never logs profile values or account identifiers. */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatbotHealthProfileCache {
    private final HealthProfileService healthProfileService;
    private final CacheManager cacheManager;

    public HealthProfileResponse get(String username) {
        Cache cache = cacheManager.getCache(CacheConfig.HEALTH_PROFILE_CACHE);
        boolean hit = cache != null && cache.get(username) != null;
        log.info("Chatbot health-profile cache {}", hit ? "hit" : "miss");
        return healthProfileService.getHealthProfile(username);
    }
}
