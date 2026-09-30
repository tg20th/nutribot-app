package com.fpt.swp391.nutribot.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class GuestRateLimitFilter extends OncePerRequestFilter {

    private static final String QUERY_PATH = "/api/v1/chatbot/query";
    private static final String SESSION_ID_HEADER = "X-Session-ID";
    private static final String X_FORWARDED_FOR = "X-Forwarded-For";
    private static final String X_REAL_IP = "X-Real-IP";

    private final ObjectMapper objectMapper;

    @Value("${app.chatbot.guest-trial-limit:3}")
    int guestTrialLimit;

    @Value("${app.chatbot.guest-quota-ttl-hours:24}")
    int guestQuotaTtlHours;

    private final ConcurrentHashMap<String, GuestQuotaEntry> quotas = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Object> keyLocks = new ConcurrentHashMap<>();

    public GuestRateLimitFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    private Object getKeyLock(String key) {
        return keyLocks.computeIfAbsent(key, k -> new Object());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!QUERY_PATH.equals(request.getRequestURI()) || !"POST".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        if (isAuthenticated(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        String sessionId = request.getHeader(SESSION_ID_HEADER);
        if (sessionId == null || sessionId.isBlank()) {
            sessionId = request.getParameter("sessionId");
        }

        String clientIp = extractClientIp(request);
        String quotaKey = buildQuotaKey(sessionId, clientIp);

        String acquiredKey = acquireOrReject(quotaKey);

        if (acquiredKey == null) {
            write429Response(response, quotaKey, 0);
            return;
        }

        response.setHeader("X-RateLimit-Limit", String.valueOf(guestTrialLimit));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(remainingForKey(acquiredKey)));
        response.setHeader("X-RateLimit-Reset", String.valueOf(getQuotaResetEpoch(acquiredKey)));

        request.setAttribute("guestQuotaKey", acquiredKey);

        filterChain.doFilter(request, response);
    }

    private boolean isAuthenticated(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken);
    }

    private String extractClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader(X_FORWARDED_FOR);
        if (forwarded != null && !forwarded.isBlank()) {
            String[] ips = forwarded.split(",");
            String ip = ips[0].trim();
            if (!ip.isBlank()) return normalizeIp(ip);
        }
        String realIp = request.getHeader(X_REAL_IP);
        if (realIp != null && !realIp.isBlank()) {
            return normalizeIp(realIp.trim());
        }
        return normalizeIp(request.getRemoteAddr());
    }

    private String normalizeIp(String ip) {
        if (ip == null) return "unknown";
        ip = ip.trim();
        if (ip.startsWith("::ffff:")) {
            ip = ip.substring(7);
        }
        return ip;
    }

    private String buildQuotaKey(String sessionId, String clientIp) {
        String safeSession = (sessionId == null || sessionId.isBlank()) ? "anon" : sessionId;
        return safeSession + "_" + clientIp;
    }

    private String acquireOrReject(String key) {
        purgeExpiredQuotas();

        Object lock = getKeyLock(key);
        synchronized (lock) {
            GuestQuotaEntry entry = quotas.get(key);

            if (entry == null) {
                entry = new GuestQuotaEntry();
                entry.consumed = 0;
                entry.reserved = 1;
                entry.lastAccess = Instant.now();
                entry.windowStart = Instant.now();
                entry.windowResetEpochSec = Instant.now().plus(Duration.ofHours(guestQuotaTtlHours)).getEpochSecond();
                quotas.put(key, entry);
                return key;
            }

            entry.lastAccess = Instant.now();

            if (entry.consumed + entry.reserved >= guestTrialLimit) {
                return null;
            }

            entry.reserved++;
            return key;
        }
    }

    private long getQuotaResetEpoch(String key) {
        GuestQuotaEntry entry = quotas.get(key);
        if (entry == null) return 0;
        return entry.windowResetEpochSec;
    }

    private void purgeExpiredQuotas() {
        Duration ttl = Duration.ofHours(guestQuotaTtlHours);
        Instant expiredBefore = Instant.now().minus(ttl);
        quotas.entrySet().removeIf(entry -> {
            GuestQuotaEntry q = entry.getValue();
            synchronized (q) {
                return q.reserved == 0 && q.lastAccess.isBefore(expiredBefore);
            }
        });
    }

    private void write429Response(HttpServletResponse response, String quotaKey, int remaining)
            throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        Instant resetAt = Instant.now().plus(Duration.ofHours(guestQuotaTtlHours));
        response.setHeader("X-RateLimit-Limit", String.valueOf(guestTrialLimit));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(0));
        response.setHeader("X-RateLimit-Reset", String.valueOf(resetAt.getEpochSecond()));

        ApiResponse<Void> body = ApiResponse.error("RATE_LIMIT_EXCEEDED",
                "Guest users can ask up to " + guestTrialLimit + " questions per day. Please try again later.", null);
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }

    public void consumeReservedTurn(String quotaKey) {
        GuestQuotaEntry entry = quotas.get(quotaKey);
        if (entry == null) return;
        synchronized (entry) {
            if (entry.reserved > 0) {
                entry.reserved--;
                entry.consumed++;
            }
        }
    }

    public void releaseReservedTurn(String quotaKey) {
        GuestQuotaEntry entry = quotas.get(quotaKey);
        if (entry == null) return;
        synchronized (entry) {
            if (entry.reserved > 0) {
                entry.reserved--;
            }
        }
    }

    public int remainingForKey(String quotaKey) {
        GuestQuotaEntry entry = quotas.get(quotaKey);
        if (entry == null) return guestTrialLimit;
        synchronized (entry) {
            return Math.max(0, guestTrialLimit - entry.consumed - entry.reserved);
        }
    }

    private static class GuestQuotaEntry {
        int consumed = 0;
        int reserved = 0;
        Instant lastAccess = Instant.now();
        Instant windowStart = Instant.now();
        long windowResetEpochSec;
    }
}
