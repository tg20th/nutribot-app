package com.fpt.swp391.nutribot.config;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class CorsConfigurationTest {

    @Test
    void allowsVercelOriginForPublicGet() {
        CorsConfiguration configuration = corsConfiguration();

        assertEquals("https://nutribot-app-mocha.vercel.app",
                configuration.checkOrigin("https://nutribot-app-mocha.vercel.app"));
        assertTrue(configuration.getAllowedMethods().contains("GET"));
        assertTrue(configuration.getAllowedHeaders().contains("Authorization"));
        assertTrue(configuration.getAllowedHeaders().contains("Content-Type"));
        assertTrue(configuration.getAllowCredentials());
    }

    @Test
    void allowsLocalOriginsAndRejectsUntrustedOrigins() {
        CorsConfiguration configuration = corsConfiguration();

        assertNotNull(configuration.checkOrigin("http://localhost:3000"));
        assertNotNull(configuration.checkOrigin("http://localhost:5173"));
        assertNull(configuration.checkOrigin("https://evil.example"));
    }

    @Test
    void supportsAuthorizationPreflightFromVercel() {
        CorsConfigurationSource source = corsConfigurationSource();
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/v1/auth/login");
        request.addHeader("Origin", "https://nutribot-app-mocha.vercel.app");
        request.addHeader("Access-Control-Request-Method", "POST");
        request.addHeader("Access-Control-Request-Headers", "content-type,authorization");

        CorsConfiguration configuration = source.getCorsConfiguration(request);

        assertNotNull(configuration);
        assertEquals("https://nutribot-app-mocha.vercel.app",
                configuration.checkOrigin(request.getHeader("Origin")));
        assertTrue(configuration.getAllowedMethods().contains(HttpMethod.POST.name()));
        assertTrue(configuration.getAllowedHeaders().contains("Authorization"));
        assertTrue(configuration.getAllowedHeaders().contains("Content-Type"));
    }

    private CorsConfigurationSource corsConfigurationSource() {
        SecurityConfig securityConfig = new SecurityConfig(
                mock(JwtAuthenticationFilter.class), mock(com.fpt.swp391.nutribot.service.AuthService.class),
                mock(com.fpt.swp391.nutribot.service.TokenBlacklistService.class), mock(JwtTokenProvider.class),
                mock(com.fpt.swp391.nutribot.filter.GuestRateLimitFilter.class), "");
        return securityConfig.corsConfigurationSource();
    }

    private CorsConfiguration corsConfiguration() {
        HttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/blogs");
        request.setAttribute("org.springframework.web.cors.CorsUtils.isCorsRequest", true);
        ((MockHttpServletRequest) request).addHeader("Origin", "https://nutribot-app-mocha.vercel.app");
        return corsConfigurationSource().getCorsConfiguration(request);
    }
}
