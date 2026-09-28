package com.fpt.swp391.nutribot.config;

import com.fpt.swp391.nutribot.service.AuthService;
import com.fpt.swp391.nutribot.service.TokenBlacklistService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Locale;

@Slf4j

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final AuthService authService;
    private final TokenBlacklistService tokenBlacklistService;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider,
                                   @Lazy AuthService authService,
                                   TokenBlacklistService tokenBlacklistService) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.authService = authService;
        this.tokenBlacklistService = tokenBlacklistService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String token = getJwtFromRequest(request);
        log.debug("JWT Filter - Path: {}, Token present: {}", request.getRequestURI(), StringUtils.hasText(token));

        if (StringUtils.hasText(token)) {
            if (jwtTokenProvider.validateToken(token) && !tokenBlacklistService.isBlacklisted(token)) {
                String username = jwtTokenProvider.getUsernameFromToken(token);
                log.debug("JWT Filter - Token valid, username: {}", username);

                var roleOpt = authService.getRoleNameByUsername(username);
                if (roleOpt.isPresent()) {
                    var authorities = Collections.singletonList(
                            new SimpleGrantedAuthority(toSpringAuthority(roleOpt.get()))
                    );

                    var authentication = new UsernamePasswordAuthenticationToken(
                            User.withUsername(username)
                                    .password("")
                                    .authorities(authorities)
                                    .build(),
                            null,
                            authorities
                    );
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                    log.debug("JWT Filter - Authentication set for user: {}, role: {}", username, roleOpt.get());
                } else {
                    log.warn("JWT Filter - User {} is suspended/banned or not found, rejecting authentication", username);
                    SecurityContextHolder.clearContext();
                }
            } else {
                log.warn("JWT Filter - Token invalid or blacklisted, clearing security context");
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }

    private String toSpringAuthority(String roleName) {
        if (roleName == null || roleName.isBlank()) {
            return "ROLE_USER";
        }
        String normalized = roleName.trim();
        return normalized.regionMatches(true, 0, "ROLE_", 0, 5)
                ? "ROLE_" + normalized.substring(5).toUpperCase(Locale.ROOT)
                : "ROLE_" + normalized.toUpperCase(Locale.ROOT);
    }
}
