package com.fpt.swp391.nutribot.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử GuestRateLimitFilter (NB-51)")
class GuestRateLimitFilterTest {

    private GuestRateLimitFilter filter;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() throws NoSuchFieldException {
        objectMapper = new ObjectMapper();
        objectMapper.findAndRegisterModules();
        filter = new GuestRateLimitFilter(objectMapper);
        filter.guestTrialLimit = 3;
        filter.guestQuotaTtlHours = 24;
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Authenticated user bypasses rate limit filter")
    void authenticatedUser_BypassesRateLimit() throws Exception {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                "testUser", null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/chatbot/query");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);

        assertEquals(200, response.getStatus());
        assertNull(response.getHeader("X-RateLimit-Limit"));
        assertNull(request.getAttribute("guestQuotaKey"));
    }

    @Test
    @DisplayName("Non-chatbot endpoint bypasses rate limit")
    void nonChatbotEndpoint_BypassesRateLimit() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/blogs");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);

        assertEquals(200, response.getStatus());
        assertNull(request.getAttribute("guestQuotaKey"));
    }

    @Test
    @DisplayName("Guest request within quota gets allowed with rate limit headers")
    void guestWithinQuota_GetsAllowed() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/chatbot/query");
        request.addHeader("X-Session-ID", "test-session-1");
        request.setRemoteAddr("192.168.1.1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);

        assertEquals(200, response.getStatus());
        assertEquals("3", response.getHeader("X-RateLimit-Limit"));
        assertNotNull(response.getHeader("X-RateLimit-Remaining"));
        assertNotNull(request.getAttribute("guestQuotaKey"));
    }

    @Test
    @DisplayName("Guest request exceeds quota returns 429 with stable error code")
    void guestExceedsQuota_Returns429WithErrorCode() throws Exception {
        filter.guestTrialLimit = 2;

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/chatbot/query");
        request.addHeader("X-Session-ID", "quota-test-session");
        request.setRemoteAddr("10.0.0.99");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        // Exhaust quota
        filter.doFilterInternal(request, response, chain);
        filter.doFilterInternal(request, response, chain);
        assertEquals(200, response.getStatus());

        // Third request should be blocked
        filter.doFilterInternal(request, response, chain);

        assertEquals(429, response.getStatus());
        assertNotNull(response.getHeader("X-RateLimit-Limit"));
        assertEquals("0", response.getHeader("X-RateLimit-Remaining"));
        assertNotNull(response.getHeader("X-RateLimit-Reset"));
        assertTrue(response.getContentAsString().contains("RATE_LIMIT_EXCEEDED"));
        assertTrue(response.getContentAsString().contains("Guest users can ask up to"));
    }

    @Test
    @DisplayName("X-Forwarded-For header extracts correct client IP")
    void xForwardedFor_ExtractsClientIp() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/chatbot/query");
        request.addHeader("X-Forwarded-For", "203.0.113.50, 70.41.3.18, 150.172.238.178");
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);

        String quotaKey = (String) request.getAttribute("guestQuotaKey");
        assertNotNull(quotaKey);
        assertTrue(quotaKey.endsWith("_203.0.113.50"));
    }

    @Test
    @DisplayName("IPv6 localhost normalized correctly")
    void ipv6Localhost_Normalizes() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/chatbot/query");
        request.setRemoteAddr("::ffff:127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);

        String quotaKey = (String) request.getAttribute("guestQuotaKey");
        assertNotNull(quotaKey);
        assertTrue(quotaKey.endsWith("_127.0.0.1"));
    }

    @Test
    @DisplayName("consumeReservedTurn moves from reserved to consumed, remaining stays same")
    void consumeReservedTurn_UpdatesCounters() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/chatbot/query");
        request.addHeader("X-Session-ID", "consume-test");
        request.setRemoteAddr("10.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);
        String key = (String) request.getAttribute("guestQuotaKey");
        assertNotNull(key);

        // After 1 request reserved: remaining = 3 - 0 - 1 = 2
        int remainingBefore = filter.remainingForKey(key);
        assertEquals(2, remainingBefore);

        filter.consumeReservedTurn(key);
        // After consume: consumed=1, reserved=0 → remaining = 3 - 1 - 0 = 2 (same)
        int remainingAfter = filter.remainingForKey(key);

        assertEquals(remainingBefore, remainingAfter, "remaining unchanged after consume (reserved->consumed)");
    }

    @Test
    @DisplayName("releaseReservedTurn decrements reserved only, remaining increases")
    void releaseReservedTurn_DecrementsReservedOnly() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/chatbot/query");
        request.addHeader("X-Session-ID", "release-test");
        request.setRemoteAddr("10.0.0.2");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);
        String key = (String) request.getAttribute("guestQuotaKey");
        assertNotNull(key);

        int remainingBefore = filter.remainingForKey(key);
        filter.releaseReservedTurn(key);
        int remainingAfter = filter.remainingForKey(key);

        assertEquals(remainingBefore + 1, remainingAfter);
    }

    @Test
    @DisplayName("remainingForKey returns full limit for unknown key")
    void unknownKey_ReturnsFullLimit() {
        int remaining = filter.remainingForKey("non-existent-key");
        assertEquals(3, remaining);
    }

    @Test
    @DisplayName("Different session IDs have independent quotas")
    void differentSessions_IndependentQuotas() throws Exception {
        filter.guestTrialLimit = 1;

        MockFilterChain chain1 = new MockFilterChain();
        MockFilterChain chain2 = new MockFilterChain();

        // Session 1
        MockHttpServletRequest req1 = new MockHttpServletRequest("POST", "/api/v1/chatbot/query");
        req1.addHeader("X-Session-ID", "session-A");
        req1.setRemoteAddr("10.0.0.1");
        MockHttpServletResponse res1 = new MockHttpServletResponse();
        filter.doFilterInternal(req1, res1, chain1);

        // Session 2
        MockHttpServletRequest req2 = new MockHttpServletRequest("POST", "/api/v1/chatbot/query");
        req2.addHeader("X-Session-ID", "session-B");
        req2.setRemoteAddr("10.0.0.2");
        MockHttpServletResponse res2 = new MockHttpServletResponse();
        filter.doFilterInternal(req2, res2, chain2);

        assertEquals(200, res1.getStatus());
        assertEquals(200, res2.getStatus());
        assertNotEquals(req1.getAttribute("guestQuotaKey"), req2.getAttribute("guestQuotaKey"));
    }

    @Test
    @DisplayName("Different IP addresses for same session have independent quotas")
    void sameSessionDifferentIp_IndependentQuotas() throws Exception {
        filter.guestTrialLimit = 1;

        MockHttpServletRequest req1 = new MockHttpServletRequest("POST", "/api/v1/chatbot/query");
        req1.addHeader("X-Session-ID", "same-session");
        req1.setRemoteAddr("192.168.0.1");
        MockHttpServletResponse res1 = new MockHttpServletResponse();
        MockFilterChain chain1 = new MockFilterChain();
        filter.doFilterInternal(req1, res1, chain1);

        MockHttpServletRequest req2 = new MockHttpServletRequest("POST", "/api/v1/chatbot/query");
        req2.addHeader("X-Session-ID", "same-session");
        req2.setRemoteAddr("192.168.0.2");
        MockHttpServletResponse res2 = new MockHttpServletResponse();
        MockFilterChain chain2 = new MockFilterChain();
        filter.doFilterInternal(req2, res2, chain2);

        assertEquals(200, res1.getStatus());
        assertEquals(200, res2.getStatus());
        assertNotEquals(req1.getAttribute("guestQuotaKey"), req2.getAttribute("guestQuotaKey"));
    }

    @Test
    @DisplayName("Response content type is application/json")
    void quotaExceeded_ContentTypeIsJson() throws Exception {
        filter.guestTrialLimit = 1;

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/chatbot/query");
        request.addHeader("X-Session-ID", "content-test");
        request.setRemoteAddr("10.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);
        filter.doFilterInternal(request, response, chain);

        assertEquals(429, response.getStatus());
        assertTrue(response.getContentType().contains("application/json"));
    }

    private static class MockFilterChain implements FilterChain {
        @Override
        public void doFilter(jakarta.servlet.ServletRequest request, jakarta.servlet.ServletResponse response) {
        }
    }
}
