package com.fpt.swp391.nutribot.config;

import com.fpt.swp391.nutribot.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Locale;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String token = getJwtFromRequest(request);

        if (StringUtils.hasText(token) && jwtTokenProvider.validateToken(token)) {
            String username = jwtTokenProvider.getUsernameFromToken(token);

            var userOpt = userRepository.findByUsername(username);
            if (userOpt.isPresent()) {
                var user = userOpt.get();
                var authorities = Collections.singletonList(
                        new SimpleGrantedAuthority(toSpringAuthority(user.getRole().getRoleName()))
                );
                UserDetails principal = org.springframework.security.core.userdetails.User
                        .withUsername(user.getUsername())
                        .password("")
                        .authorities(authorities)
                        .build();

                var authentication = new UsernamePasswordAuthenticationToken(
                        principal,
                        null,
                        authorities
                );
                SecurityContextHolder.getContext().setAuthentication(authentication);
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
