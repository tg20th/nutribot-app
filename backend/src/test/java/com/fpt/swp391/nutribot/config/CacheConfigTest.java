package com.fpt.swp391.nutribot.config;

import com.fpt.swp391.nutribot.service.HealthProfileService;
import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class CacheConfigTest {
    @Test
    void health_profile_cache_supports_read_and_explicit_eviction() throws Exception {
        CacheManager manager = new CacheConfig().cacheManager();
        Cache cache = manager.getCache(CacheConfig.HEALTH_PROFILE_CACHE);
        assertThat(cache).isNotNull();
        cache.put("member", "profile");
        assertThat(cache.get("member", String.class)).isEqualTo("profile");
        cache.evict("member");
        assertThat(cache.get("member")).isNull();

        Method read = HealthProfileService.class.getMethod("getHealthProfile", String.class);
        Method update = HealthProfileService.class.getMethod("updateHealthProfile", String.class,
                com.fpt.swp391.nutribot.dto.request.HealthProfileUpdateRequest.class);
        assertThat(read.getAnnotation(Cacheable.class).cacheNames()).contains(CacheConfig.HEALTH_PROFILE_CACHE);
        assertThat(update.getAnnotation(CacheEvict.class).cacheNames()).contains(CacheConfig.HEALTH_PROFILE_CACHE);
    }
}
