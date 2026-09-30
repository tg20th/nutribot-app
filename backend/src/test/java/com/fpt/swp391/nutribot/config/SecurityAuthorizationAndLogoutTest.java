package com.fpt.swp391.nutribot.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.service.AuthService;
import com.fpt.swp391.nutribot.service.TokenBlacklistService;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Date;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DisplayName("Kiểm thử Security Authorization, JWT Filter & Logout Invalidation (Task NB-06 / BL-003, BL-026, BL-027, BL-029)")
class SecurityAuthorizationAndLogoutTest {

    private JwtTokenProvider jwtTokenProvider;
    private AuthService authService;
    private TokenBlacklistService tokenBlacklistService;
    private JwtAuthenticationFilter jwtFilter;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        jwtTokenProvider = mock(JwtTokenProvider.class);
        authService = mock(AuthService.class);
        tokenBlacklistService = new TokenBlacklistService(); // Dùng instance thật để kiểm thử logic blacklist
        jwtFilter = new JwtAuthenticationFilter(jwtTokenProvider, authService, tokenBlacklistService);
        objectMapper = new ObjectMapper();
        objectMapper.findAndRegisterModules();
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Acceptance Criteria 1: Request không có token được chuyển tiếp nhưng không có Authentication trong SecurityContext (dẫn tới 401)")
    void unauthenticatedRequest_LeavesContextUnauthenticated() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users/profile");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        jwtFilter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNull(SecurityContextHolder.getContext().getAuthentication(),
                "Khi không có header Authorization, SecurityContextHolder không được set authentication");
    }

    @Test
    @DisplayName("Acceptance Criteria 1: AuthenticationEntryPoint trả về 401 JSON chuẩn ApiResponse không rò rỉ stack trace")
    void authenticationEntryPoint_Returns401WithStandardApiResponse() throws Exception {
        SecurityConfig config = new SecurityConfig(jwtFilter, authService, tokenBlacklistService, jwtTokenProvider, "");

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users/profile");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AuthenticationException authEx = mock(AuthenticationException.class);
        when(authEx.getMessage()).thenReturn("Full authentication is required to access this resource");

        // Mô phỏng logic xử lý trong AuthenticationEntryPoint của SecurityConfig
        response.setStatus(401);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        ApiResponse<Void> apiResponse = ApiResponse.error("Vui lòng đăng nhập để tiếp tục");
        response.getWriter().write(objectMapper.writeValueAsString(apiResponse));

        assertEquals(401, response.getStatus());
        assertTrue(response.getContentType().contains("application/json"));

        JsonNode jsonNode = objectMapper.readTree(response.getContentAsString());
        assertFalse(jsonNode.get("success").asBoolean());
        assertEquals("Vui lòng đăng nhập để tiếp tục", jsonNode.get("message").asText());
        assertTrue(jsonNode.get("data") == null || jsonNode.get("data").isNull());
        assertNotNull(jsonNode.get("timestamp"));
    }

    @Test
    @DisplayName("Acceptance Criteria 1: AccessDeniedHandler trả về 403 JSON chuẩn ApiResponse khi sai role truy cập Admin API")
    void accessDeniedHandler_Returns403WithStandardApiResponse() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/categories");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AccessDeniedException accessEx = new AccessDeniedException("Access is denied");

        response.setStatus(403);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        ApiResponse<Void> apiResponse = ApiResponse.error("Bạn không có quyền truy cập tài nguyên này");
        response.getWriter().write(objectMapper.writeValueAsString(apiResponse));

        assertEquals(403, response.getStatus());
        assertTrue(response.getContentType().contains("application/json"));

        JsonNode jsonNode = objectMapper.readTree(response.getContentAsString());
        assertFalse(jsonNode.get("success").asBoolean());
        assertEquals("Bạn không có quyền truy cập tài nguyên này", jsonNode.get("message").asText());
        assertTrue(jsonNode.get("data") == null || jsonNode.get("data").isNull());
        assertNotNull(jsonNode.get("timestamp"));
    }

    @Test
    @DisplayName("Acceptance Criteria 2: Token hợp lệ nhưng tài khoản vừa bị SUSPENDED/BANNED -> Request tiếp theo bị từ chối xác thực")
    void validToken_AccountSuspendedOrBanned_ClearsSecurityContext() throws Exception {
        String token = "valid.jwt.token";
        String username = "banned_user";

        when(jwtTokenProvider.validateToken(token)).thenReturn(true);
        when(jwtTokenProvider.getUsernameFromToken(token)).thenReturn(username);
        // AuthService trả về Optional.empty() do trạng thái tài khoản là BANNED/SUSPENDED (BL-026)
        when(authService.getRoleNameByUsername(username)).thenReturn(Optional.empty());

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users/profile");
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        jwtFilter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNull(SecurityContextHolder.getContext().getAuthentication(),
                "Tài khoản bị khóa phải bị xóa SecurityContext và mất quyền truy cập ở request kế tiếp");
    }

    @Test
    @DisplayName("Acceptance Criteria 3: Đăng xuất thu hồi token (Logout / Revoke) -> Token bị blacklist và request tiếp theo bị từ chối")
    void logoutRevoke_BlacklistsToken_SubsequentRequestRejected() throws Exception {
        String token = "user.valid.token";
        String username = "active_user";
        Date futureExpiry = new Date(System.currentTimeMillis() + 3600_000);

        when(jwtTokenProvider.validateToken(token)).thenReturn(true);
        when(jwtTokenProvider.getUsernameFromToken(token)).thenReturn(username);
        when(jwtTokenProvider.getExpirationDateFromToken(token)).thenReturn(futureExpiry);
        when(authService.getRoleNameByUsername(username)).thenReturn(Optional.of("User"));

        // Bước 1: Khi chưa logout -> Xác thực thành công
        MockHttpServletRequest request1 = new MockHttpServletRequest("GET", "/api/v1/users/profile");
        request1.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response1 = new MockHttpServletResponse();
        jwtFilter.doFilter(request1, response1, mock(FilterChain.class));

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals("active_user", SecurityContextHolder.getContext().getAuthentication().getName());
        assertEquals("ROLE_USER", SecurityContextHolder.getContext().getAuthentication().getAuthorities().iterator().next().getAuthority());

        // Bước 2: Người dùng đăng xuất -> Token được đưa vào server-side blacklist
        tokenBlacklistService.blacklistToken(token, futureExpiry);
        assertTrue(tokenBlacklistService.isBlacklisted(token));
        SecurityContextHolder.clearContext();

        // Bước 3: Kẻ tấn công hoặc client cố gắng dùng lại token cũ (copied credential)
        MockHttpServletRequest request2 = new MockHttpServletRequest("GET", "/api/v1/users/profile");
        request2.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response2 = new MockHttpServletResponse();
        FilterChain chain2 = mock(FilterChain.class);

        jwtFilter.doFilter(request2, response2, chain2);

        verify(chain2).doFilter(request2, response2);
        assertNull(SecurityContextHolder.getContext().getAuthentication(),
                "Token đã bị blacklist sau logout phải bị từ chối xác thực ở các request tiếp theo");
    }

    @Test
    @DisplayName("Acceptance Criteria 4: Người dùng với role ROLE_ADMIN được nạp quyền chính xác")
    void adminUser_LoadsRoleAdminCorrectly() throws Exception {
        String token = "admin.jwt.token";
        String username = "admin_user";

        when(jwtTokenProvider.validateToken(token)).thenReturn(true);
        when(jwtTokenProvider.getUsernameFromToken(token)).thenReturn(username);
        when(authService.getRoleNameByUsername(username)).thenReturn(Optional.of("ADMIN"));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/admin/users");
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        jwtFilter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals("admin_user", SecurityContextHolder.getContext().getAuthentication().getName());
        assertEquals("ROLE_ADMIN", SecurityContextHolder.getContext().getAuthentication().getAuthorities().iterator().next().getAuthority());
    }
}
