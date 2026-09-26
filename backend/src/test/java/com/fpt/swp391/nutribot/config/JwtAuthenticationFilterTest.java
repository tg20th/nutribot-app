package com.fpt.swp391.nutribot.config;

import com.fpt.swp391.nutribot.entity.Role;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.repository.UserRepository;
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
        UserRepository userRepository = mock(UserRepository.class);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(tokenProvider, userRepository);
        User user = User.builder()
                .username("profile-user")
                .role(Role.builder().roleName("User").build())
                .build();
        when(tokenProvider.validateToken("valid-token")).thenReturn(true);
        when(tokenProvider.getUsernameFromToken("valid-token")).thenReturn("profile-user");
        when(userRepository.findByUsername("profile-user")).thenReturn(Optional.of(user));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer valid-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> { };

        filter.doFilter(request, response, chain);

        verify(userRepository).findByUsername("profile-user");
        assertEquals("profile-user", SecurityContextHolder.getContext().getAuthentication().getName());
        assertEquals("ROLE_USER", SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().iterator().next().getAuthority());
    }
}
