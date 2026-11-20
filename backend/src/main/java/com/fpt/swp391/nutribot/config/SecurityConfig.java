package com.fpt.swp391.nutribot.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.exception.AccountBannedException;
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
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import java.net.URLEncoder;
import java.time.Instant;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * =========================================================================================
 * 🛡️ MODULE 2: SPRING SECURITY & AUTHORIZATION CONFIGURATION (DÀNH CHO TRƯỜNG BE)
 * =========================================================================================
 * [Nhiệm vụ chính]:
 * - Cấu hình SecurityFilterChain phân quyền truy cập server-side.
 * - Triển khai cơ chế Deny-by-default: Mọi request mặc định bắt buộc authenticate, chỉ allowlist những API thực sự public.
 * - Tích hợp chuỗi Filter: JwtAuthenticationFilter -> GuestRateLimitFilter -> UsernamePasswordAuthenticationFilter.
 * - Xử lý lỗi 401 Unauthorized và 403 Forbidden đồng nhất theo chuẩn JSON ApiResponse.
 * - Xử lý đăng nhập Google OAuth2 redirect an toàn về Frontend.
 * =========================================================================================
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final AuthService authService;
    private final TokenBlacklistService tokenBlacklistService;
    private final JwtTokenProvider jwtTokenProvider;
    private final GuestRateLimitFilter guestRateLimitFilter;
    private final String frontendBaseUrl;

    @Autowired
    public SecurityConfig(@Lazy JwtAuthenticationFilter jwtAuthenticationFilter,
                          @Lazy AuthService authService,
                          TokenBlacklistService tokenBlacklistService,
                          JwtTokenProvider jwtTokenProvider,
                          @Lazy GuestRateLimitFilter guestRateLimitFilter,
                          @Value("${spring.security.oauth2.client.registration.google.client-id:}") String googleClientId,
                          @Value("${FRONTEND_BASE_URL:http://localhost:5173}") String frontendBaseUrl) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.authService = authService;
        this.tokenBlacklistService = tokenBlacklistService;
        this.jwtTokenProvider = jwtTokenProvider;
        this.guestRateLimitFilter = guestRateLimitFilter;
        this.frontendBaseUrl = frontendBaseUrl.replaceAll("/+$", "");
        this.oauth2Enabled = StringUtils.hasText(googleClientId);
    }

    private final boolean oauth2Enabled;

    public SecurityConfig(@Lazy JwtAuthenticationFilter jwtAuthenticationFilter,
                          @Lazy AuthService authService,
                          TokenBlacklistService tokenBlacklistService,
                          JwtTokenProvider jwtTokenProvider,
                          @Lazy GuestRateLimitFilter guestRateLimitFilter,
                          String googleClientId) {
        this(jwtAuthenticationFilter, authService, tokenBlacklistService, jwtTokenProvider,
                guestRateLimitFilter, googleClientId, "http://localhost:5173");
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                // =================================================================================
                // KHỐI 1: THỨ TỰ THỰC THI FILTER (FILTER CHAIN ORDER)
                // JwtAuthenticationFilter (Xác thực Token) -> GuestRateLimitFilter -> UsernamePasswordAuthenticationFilter
                // =================================================================================
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(guestRateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // =================================================================================
                // KHỐI 2: PHÂN QUYỀN TRUY CẬP (SERVER-SIDE AUTHORIZATION RULES)
                // =================================================================================
                .authorizeHttpRequests(auth -> auth
                        // CORS preflight requests must be handled before authentication.
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // 1. Public Auth Endpoints (Đăng ký, Đăng nhập, OTP)
                        .requestMatchers(
                                "/api/v1/auth/login",
                                "/api/v1/auth/register",
                                "/api/v1/auth/verify-otp",
                                "/api/v1/auth/resend-otp"
                        ).permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/logout").permitAll()

                        // 2. Public Content Endpoints (Xem blog, video, trang chủ, tìm kiếm công khai)
                        .requestMatchers(HttpMethod.GET, "/api/v1/blogs/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/videos/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/home/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/feed/home").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/community/highlights").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/search/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/contents/*/comments").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/contents/*/engagement").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/contents/*/vote").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/categories/**").permitAll()

                        // 3. User Profile: Chặn anonymous truy cập profile cá nhân (/api/v1/users/profile)
                        .requestMatchers("/api/v1/users/profile", "/api/v1/users/profile/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/users/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/users/*/posts").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/users/*/recipes").permitAll()

                        // 4. Chatbot query công khai (có hỗ trợ khách vãng lai dùng thử)
                        .requestMatchers(HttpMethod.POST, "/api/v1/chatbot/query").permitAll()

                        // 5. Actuator & OAuth
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/login/oauth2/code/**").permitAll()

                        // 6. Admin APIs: Bắt buộc quyền ROLE_ADMIN
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v1/categories/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/categories/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/categories/**").hasRole("ADMIN")

                        // 7. Mặc định mọi request còn lại bắt buộc đăng nhập (Deny-by-default)
                        .anyRequest().authenticated()
                )
                // =================================================================================
                // KHỐI 3: XỬ LÝ LỖI XÁC THỰC VÀ PHÂN QUYỀN (401 UNAUTHORIZED & 403 FORBIDDEN)
                // =================================================================================
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
            http.oauth2Login(oauth2 -> oauth2.successHandler(oauth2SuccessHandler()).failureHandler(oauth2FailureHandler()));
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
                log.info("OAuth2 success handler completed account authentication");

                String frontendUrl = frontendBaseUrl + "/auth/callback?token=" + URLEncoder.encode(authResponse.getToken(), StandardCharsets.UTF_8)
                        + "&username=" + URLEncoder.encode(authResponse.getUsername(), StandardCharsets.UTF_8)
                        + "&role=" + URLEncoder.encode(authResponse.getRole(), StandardCharsets.UTF_8);

                response.sendRedirect(frontendUrl);
            } catch (Exception e) {
                clearOAuthAuthentication(request);
                String errorCode = isBannedAccount(e) ? "ACCOUNT_BANNED" : "OAUTH_FAILED";
                log.warn("OAuth2 success handler failed: exceptionClass={}, selectedErrorCode={}", e.getClass().getName(), errorCode, e);
                response.sendRedirect(buildOAuthErrorRedirect(request, errorCode));
            }
        };
    }

    private AuthenticationFailureHandler oauth2FailureHandler() {
        return (request, response, exception) -> {
            clearOAuthAuthentication(request);
            String errorCode = isBannedAccount(exception) ? "ACCOUNT_BANNED" : "OAUTH_FAILED";
            log.warn("OAuth2 failure handler invoked: exceptionClass={}, selectedErrorCode={}", exception.getClass().getName(), errorCode, exception);
            response.sendRedirect(buildOAuthErrorRedirect(request, errorCode));
        };
    }

    private boolean isBannedAccount(Exception exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof AccountBannedException) return true;
            String message = cause.getMessage();
            if (message != null && (message.toLowerCase().contains("banned")
                    || message.toLowerCase().contains("suspended")
                    || message.contains("bá»‹ khÃ³a")
                    || message.contains("Ä‘Ã£ bá»‹ khÃ³a"))) return true;
        }
        return false;
    }

    private String buildOAuthErrorRedirect(HttpServletRequest request, String errorCode) {
        return frontendBaseUrl + "/auth/callback?error="
                + URLEncoder.encode(errorCode, StandardCharsets.UTF_8);
    }

    private void clearOAuthAuthentication(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        var session = request.getSession(false);
        if (session != null) session.invalidate();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of(
                "https://nutribot-app-mocha.vercel.app",
                "http://localhost:*",
                "http://127.0.0.1:*",
                "https://*.ngrok-free.app",
                "https://*.ngrok.io",
                "https://*.ngrok-free.dev"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList(
                "Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With", "X-Session-ID"));
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
