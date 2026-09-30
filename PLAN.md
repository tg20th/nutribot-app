# Plan NB-31: Chatbot Gateway Security & Resilience

## Context

Task NB-31 yêu cầu xây dựng Java gateway giữa frontend và FastAPI AI service. Code hiện tại đã có nền tảng tốt nhưng có **1 bug nghiêm trọng** và **2 gap** chưa thỏa mãn requirement:

1. **Bug:** Config key `ai.service.base-url` (dot) ≠ `ai-service.base-url` (hyphen) trong properties → config không đọc được
2. **Gap:** Không có correlation ID cho logging (BL-009)
3. **Gap:** Không có circuit breaker / retry policy

---

## Thay đổi

### 1. Fix config property name — `ChatbotGatewayService.java`

- Sửa `@Value("${ai.service.base-url:...}")` → `@Value("${ai-service.base-url:...}")` (line 39)
- Khớp với `MealPlannerService` và `application.properties`

### 2. Thêm Correlation ID — Servlet Filter

**File:** `src/main/java/com/fpt/swp391/nutribot/config/CorrelationIdFilter.java`

- Mở rộng `OncePerRequestFilter`
- Sinh UUID cho `X-Correlation-ID` header (hoặc dùng header có sẵn)
- Gắn vào `MDC` (Mapped Diagnostic Context) để log có request ID
- Trả về header `X-Correlation-ID` cho client
- **Không log sensitive data** (userContext, conversationHistory) — chỉ log metadata (sessionId prefix, message length)

**File:** `src/main/java/com/fpt/swp391/nutribot/config/SecurityConfig.java`

- Đăng ký `CorrelationIdFilter` vào filter chain trước `JwtAuthenticationFilter`

### 3. Thêm Circuit Breaker (đơn giản, không thêm dependency)

Thay vì thêm Resilience4j (cần thêm dependency, tăng complexity), dùng **manual circuit breaker state machine** trong `ChatbotGatewayService`:

- State: `CLOSED` → `OPEN` → `HALF_OPEN`
- Khi AI fail **3 lần liên tiếp** trong **30 giây** → OPEN (fast-fail ngay, không gọi AI)
- OPEN state tự động chuyển sang `HALF_OPEN` sau **30 giây cooldown**
- HALF_OPEN: cho 1 request thử, thành công → CLOSED, thất bại → OPEN lại
- Khi OPEN: trả fallback ngay lập tức, không retry

### 4. Thêm logging correlation vào service

- `ChatbotGatewayService.getReply()`: thêm log với correlation ID từ MDC
- Log: request bắt đầu, AI response thành công, AI fail, fallback triggered
- **KHÔNG log** nội dung message, userContext, conversationHistory

---

## File cần sửa / tạo

| File | Action |
|---|---|
| `service/ChatbotGatewayService.java` | Sửa config key + thêm circuit breaker + MDC logging |
| `controller/ChatbotController.java` | Không cần sửa |
| `config/SecurityConfig.java` | Đăng ký CorrelationIdFilter |
| `config/CorrelationIdFilter.java` | **Tạo mới** — servlet filter sinh correlation ID |

---

## Verification

1. `cd backend && ./mvnw spring-boot:run` — compile & start thành công
2. `curl -X POST http://localhost:8080/api/v1/chatbot/query -H "Content-Type: application/json" -d "..."` — test với request có `X-Correlation-ID`
3. Check log: mỗi request có `[correlation-id-here]` trong log line
4. Test khi AI down: trả `NutriBot is temporarily unavailable` thay vì stack trace
5. Test sau 3 AI fail liên tiếp: circuit OPEN, không gọi AI nữa
