package com.fpt.swp391.nutribot.config;

import com.fpt.swp391.nutribot.service.AuthService;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JwtAuthenticationFilterTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void loadsRoleWithUserBeforeBuildingAuthentication() throws Exception {
        JwtTokenProvider tokenProvider = mock(JwtTokenProvider.class);
        AuthService authService = mock(AuthService.class);
        com.fpt.swp391.nutribot.service.TokenBlacklistService blacklistService = mock(com.fpt.swp391.nutribot.service.TokenBlacklistService.class);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(tokenProvider, authService, blacklistService);
        when(tokenProvider.validateToken("valid-token")).thenReturn(true);
        when(blacklistService.isBlacklisted("valid-token")).thenReturn(false);
        when(tokenProvider.getUsernameFromToken("valid-token")).thenReturn("profile-user");
        when(authService.getRoleNameByUsername("profile-user")).thenReturn(Optional.of("User"));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer valid-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> { };

        filter.doFilter(request, response, chain);

        verify(authService).getRoleNameByUsername("profile-user");
        assertEquals("profile-user", SecurityContextHolder.getContext().getAuthentication().getName());
        assertEquals("ROLE_USER", SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().iterator().next().getAuthority());
    }
}
