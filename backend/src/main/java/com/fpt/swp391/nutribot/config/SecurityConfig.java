package com.fpt.swp391.nutribot.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.filter.GuestRateLimitFilter;
import com.fpt.swp391.nutribot.service.AuthService;
import com.fpt.swp391.nutribot.service.TokenBlacklistService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import org.springframework.beans.factory.annotation.Value;
import java.net.URLEncoder;
import java.time.Instant;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final AuthService authService;
    private final TokenBlacklistService tokenBlacklistService;
    private final JwtTokenProvider jwtTokenProvider;
    private final GuestRateLimitFilter guestRateLimitFilter;

    public SecurityConfig(@Lazy JwtAuthenticationFilter jwtAuthenticationFilter,
                          @Lazy AuthService authService,
                          TokenBlacklistService tokenBlacklistService,
                          JwtTokenProvider jwtTokenProvider,
                          @Lazy GuestRateLimitFilter guestRateLimitFilter,
                          @Value("${spring.security.oauth2.client.registration.google.client-id:}") String googleClientId) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.authService = authService;
        this.tokenBlacklistService = tokenBlacklistService;
        this.jwtTokenProvider = jwtTokenProvider;
        this.guestRateLimitFilter = guestRateLimitFilter;
        this.oauth2Enabled = StringUtils.hasText(googleClientId);
    }

    private final boolean oauth2Enabled;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                // Filter order: JwtAuthenticationFilter → GuestRateLimitFilter → UsernamePasswordAuthenticationFilter
                // Both filters are added before UsernamePasswordAuthenticationFilter
                // HttpSecurity adds them in order, so JwtAuthenticationFilter runs first
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(guestRateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Public Auth Endpoints
                        .requestMatchers(
                                "/api/v1/auth/login",
                                "/api/v1/auth/register",
                                "/api/v1/auth/verify-otp",
                                "/api/v1/auth/resend-otp"
                        ).permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/logout").permitAll()

                        // Public Content Endpoints
                        .requestMatchers(HttpMethod.GET, "/api/v1/blogs/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/videos/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/home/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/feed/home").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/search/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/contents/*/comments").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/contents/*/vote").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/categories/**").permitAll()

                        // Public Chatbot query (hỗ trợ khách vãng lai)
                        .requestMatchers(HttpMethod.POST, "/api/v1/chatbot/query").permitAll()

                        // Actuator & OAuth
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/login/oauth2/code/**").permitAll()

                        // Admin APIs
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v1/categories/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/categories/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/categories/**").hasRole("ADMIN")

                        // Member/Authenticated endpoints (Deny-by-default)
                        .anyRequest().authenticated()
                )
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, exception) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json");
                            response.setCharacterEncoding("UTF-8");
                            ApiResponse<Void> apiResponse = ApiResponse.error("Vui lòng đăng nhập để tiếp tục");
                            response.getWriter().write(writeJsonResponse(apiResponse));
                        })
                        .accessDeniedHandler((request, response, exception) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType("application/json");
                            response.setCharacterEncoding("UTF-8");
                            ApiResponse<Void> apiResponse = ApiResponse.error("Bạn không có quyền truy cập tài nguyên này");
                            response.getWriter().write(writeJsonResponse(apiResponse));
                        })
                )
                .logout(logout -> logout
                        .logoutUrl("/api/v1/auth/logout")
                        .addLogoutHandler((request, response, authentication) -> {
                            String token = extractToken(request);
                            if (StringUtils.hasText(token) && jwtTokenProvider.validateToken(token)) {
                                try {
                                    Date expiryDate = jwtTokenProvider.getExpirationDateFromToken(token);
                                    tokenBlacklistService.blacklistToken(token, expiryDate);
                                } catch (Exception e) {
                                    // Bỏ qua lỗi parse expiration nếu token bị lỗi
                                }
                            }
                            SecurityContextHolder.clearContext();
                        })
                        .logoutSuccessHandler((request, response, authentication) -> {
                            response.setStatus(HttpServletResponse.SC_OK);
                            response.setContentType("application/json");
                            response.setCharacterEncoding("UTF-8");
                            ApiResponse<Void> apiResponse = ApiResponse.success("Đăng xuất thành công", null);
                            response.getWriter().write(writeJsonResponse(apiResponse));
                        })
                );

        if (oauth2Enabled) {
            http.oauth2Login(oauth2 -> oauth2.successHandler(oauth2SuccessHandler()));
        }

        return http.build();
    }

    private String extractToken(jakarta.servlet.http.HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7).trim();
        }
        return null;
    }

    private String writeJsonResponse(Object body) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            mapper.findAndRegisterModules();
            mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
            return mapper.writeValueAsString(body);
        } catch (Exception e) {
            return "{\"success\":false,\"message\":\"Internal error\"}";
        }
    }

    private AuthenticationSuccessHandler oauth2SuccessHandler() {
        return (request, response, authentication) -> {
            try {
                OAuth2AuthenticationToken authToken = (OAuth2AuthenticationToken) authentication;
                OAuth2User oauth2User = authToken.getPrincipal();
                Map<String, Object> attrs = oauth2User.getAttributes();

                String email = (String) attrs.get("email");
                String fullName = (String) attrs.get("name");
                String picture = (String) attrs.get("picture");

                var authResponse = authService.handleOAuth2Login(email, fullName, picture);

                String frontendBaseUrl = determineFrontendBaseUrl(request);
                String frontendUrl = frontendBaseUrl + "/auth/callback?token=" + URLEncoder.encode(authResponse.getToken(), StandardCharsets.UTF_8)
                        + "&username=" + URLEncoder.encode(authResponse.getUsername(), StandardCharsets.UTF_8)
                        + "&role=" + URLEncoder.encode(authResponse.getRole(), StandardCharsets.UTF_8);

                response.sendRedirect(frontendUrl);
            } catch (Exception e) {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                response.setContentType("application/json");
                response.getWriter().write("{\"success\":false,\"message\":\"OAuth login failed: " + e.getMessage() + "\"}");
            }
        };
    }

    private String determineFrontendBaseUrl(HttpServletRequest request) {
        String forwardedHost = request.getHeader("X-Forwarded-Host");
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        if (StringUtils.hasText(forwardedHost)) {
            String proto = StringUtils.hasText(forwardedProto) ? forwardedProto : "https";
            return proto + "://" + forwardedHost;
        }
        String origin = request.getHeader("Origin");
        if (StringUtils.hasText(origin)) {
            return origin;
        }
        String referer = request.getHeader("Referer");
        if (StringUtils.hasText(referer)) {
            try {
                java.net.URI uri = java.net.URI.create(referer);
                return uri.getScheme() + "://" + uri.getAuthority();
            } catch (Exception ignored) {
            }
        }
        return "http://localhost:5173";
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of(
                "http://localhost:*",
                "http://127.0.0.1:*",
                "https://*.ngrok-free.app",
                "https://*.ngrok.io",
                "https://*.ngrok-free.dev",
                "*"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Requested-With"));
        configuration.setExposedHeaders(List.of("Authorization"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.findAndRegisterModules();
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper;
    }
}
