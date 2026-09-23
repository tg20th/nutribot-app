# NutriBot Backend Sprint 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng Phase 0 Core Framework (cấu hình DB, ApiResponse, Global Exception, BaseEntity) và hoàn thiện nền tảng Sprint 1 cho Backend gồm Domain 1 của Trường (Entities User/Role, JWT Auth Register & Login) và Domain 2 của Thắng (Entities UserProfile/Ingredient/Allergy, Profile CRUD và tính toán BMI) có thể chạy, kết nối DB và pass toàn bộ unit/integration test.

**Architecture:** Kiến trúc phân lớp chuẩn Spring Boot (Controller -> Service -> Repository -> JPA Entity) kết nối CSDL Microsoft SQL Server `NutriBotV2`. Áp dụng mô hình tách rời domain (Domain Decoupling): Domain Auth/User do Trường làm chủ, Domain Profile/Health do Thắng làm chủ, giao tiếp thống nhất qua chuẩn định dạng `ApiResponse<T>`.

**Tech Stack:** Java 25, Spring Boot 4.1.1, Spring Data JPA (Hibernate), Spring Security 6/7, JWT (`jjwt 0.11.5`), Microsoft SQL Server JDBC, Lombok, JUnit 5, Mockito.

**Spec:** [`docs/superpowers/specs/2026-09-24-nutribot-backend-roadmap-design.md`](file:///C:/Users/PC/Documents/26FA/SWP391/Project/swp391_group7_nutribot/docs/superpowers/specs/2026-09-24-nutribot-backend-roadmap-design.md)

---

## Global Constraints

- **Java Version:** Java 25 (sử dụng record, pattern matching, switch expressions khi thích hợp).
- **Package Base:** `com.fpt.swp391.nutribot`.
- **Database Schema:** Tuân thủ 100% tên bảng và kiểu dữ liệu trong `backend/sql/Database.sql` (bảng `roles`, `users`, `user_profiles`, `ingredients`, `user_allergies`).
- **Response Format:** Mọi REST Controller đều phải bọc dữ liệu trả về trong `ApiResponse<T>`.
- **Zero Conflict Policy:** File nào thuộc quyền sở hữu của Trường thì Thắng không sửa, file nào thuộc Thắng thì Trường không sửa; code chung đặt tại `config`, `dto/response`, `exception`.

---

## Review Focus

1. **Sai mật khẩu / Email trùng:** Xử lý ngoại lệ chuẩn HTTP 400 Bad Request / 409 Conflict với thông báo rõ ràng thay vì ném 500 Internal Server Error.
2. **Token JWT hết hạn hoặc giả mạo:** `JwtAuthenticationFilter` phải bắt được và trả về 401 Unauthorized thay vì làm sập filter chain.
3. **Tính toán BMI với chiều cao = 0 hoặc âm:** `UserProfileService` phải validate `height_cm > 0` và `weight_kg > 0` trước khi chia để tránh lỗi chia cho 0.
4. **Cơ chế Cascade UserProfile:** Khi xóa User hoặc cập nhật Profile, quan hệ `@OneToOne` giữa `User` và `UserProfile` phải đồng bộ khóa ngoại `user_id`.
5. **CORS Configuration:** Spring Security phải cho phép Frontend React (chạy trên port 3000 và 5173) gọi API mà không bị chặn CORS header.

---

## Task Decomposition

### Task 0: Thiết lập Phase 0 Core Setup (DB, ApiResponse, BaseEntity, Exception Handling)

**Files:**
- Modify: `backend/src/main/resources/application.properties`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/dto/response/ApiResponse.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/exception/AppException.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/exception/ResourceNotFoundException.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/exception/GlobalExceptionHandler.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/entity/BaseEntity.java`
- Test: `backend/src/test/java/com/fpt/swp391/nutribot/GlobalExceptionHandlerTest.java`

**Interfaces:**
- Produces: `ApiResponse<T>`, `GlobalExceptionHandler`, `BaseEntity` cho toàn bộ các Task sau.

- [ ] **Step 1: Viết test cho ApiResponse & GlobalExceptionHandler**

```java
package com.fpt.swp391.nutribot;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.exception.GlobalExceptionHandler;
import com.fpt.swp391.nutribot.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handleResourceNotFoundException_shouldReturn404() {
        ResourceNotFoundException ex = new ResourceNotFoundException("User not found");
        ResponseEntity<ApiResponse<Void>> response = handler.handleNotFound(ex);
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertFalse(response.getBody().success());
        assertEquals("User not found", response.getBody().message());
    }
}
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `cd backend; ./mvnw test -Dtest=GlobalExceptionHandlerTest`
Expected: FAIL do chưa tồn tại các class exception và response.

- [ ] **Step 3: Triển khai mã nguồn Phase 0**

Cập nhật `backend/src/main/resources/application.properties`:
```properties
spring.application.name=swp391_group7_nutribot

spring.datasource.url=jdbc:sqlserver://localhost:1433;databaseName=NutriBotV2;encrypt=true;trustServerCertificate=true
spring.datasource.username=sa
spring.datasource.password=123456
spring.datasource.driver-class-name=com.microsoft.sqlserver.jdbc.SQLServerDriver

spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true

nutribot.jwt.secret=404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970
nutribot.jwt.expiration-ms=86400000
```

Tạo `backend/src/main/java/com/fpt/swp391/nutribot/dto/response/ApiResponse.java`:
```java
package com.fpt.swp391.nutribot.dto.response;

import java.time.Instant;

public record ApiResponse<T>(
    boolean success,
    String message,
    T data,
    Instant timestamp
) {
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, "Success", data, Instant.now());
    }

    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(true, message, data, Instant.now());
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, message, null, Instant.now());
    }
}
```

Tạo `backend/src/main/java/com/fpt/swp391/nutribot/exception/AppException.java`:
```java
package com.fpt.swp391.nutribot.exception;

import org.springframework.http.HttpStatus;

public class AppException extends RuntimeException {
    private final HttpStatus status;

    public AppException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
```

Tạo `backend/src/main/java/com/fpt/swp391/nutribot/exception/ResourceNotFoundException.java`:
```java
package com.fpt.swp391.nutribot.exception;

import org.springframework.http.HttpStatus;

public class ResourceNotFoundException extends AppException {
    public ResourceNotFoundException(String message) {
        super(message, HttpStatus.NOT_FOUND);
    }
}
```

Tạo `backend/src/main/java/com/fpt/swp391/nutribot/exception/GlobalExceptionHandler.java`:
```java
package com.fpt.swp391.nutribot.exception;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> handleAppException(AppException ex) {
        return ResponseEntity.status(ex.getStatus()).body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException ex) {
        String errors = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(errors));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneralException(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Internal Server Error: " + ex.getMessage()));
    }
}
```

Tạo `backend/src/main/java/com/fpt/swp391/nutribot/entity/BaseEntity.java`:
```java
package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@MappedSuperclass
@Getter
@Setter
public abstract class BaseEntity {

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
```

- [ ] **Step 4: Chạy test lại để xác nhận pass**

Run: `cd backend; ./mvnw test -Dtest=GlobalExceptionHandlerTest`
Expected: PASS 1/1 test.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/application.properties backend/src/main/java/com/fpt/swp391/nutribot/dto/ backend/src/main/java/com/fpt/swp391/nutribot/exception/ backend/src/main/java/com/fpt/swp391/nutribot/entity/BaseEntity.java backend/src/test/java/com/fpt/swp391/nutribot/GlobalExceptionHandlerTest.java
git commit -m "feat(core): setup Phase 0 core baseline, ApiResponse, GlobalExceptionHandler and BaseEntity"
```

---

### Task 1: Domain Trường Foundation - Entities & Repositories User/Role (Task #3)

**Files:**
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/entity/Role.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/entity/User.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/repository/RoleRepository.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/repository/UserRepository.java`
- Test: `backend/src/test/java/com/fpt/swp391/nutribot/repository/UserRepositoryTest.java`

**Interfaces:**
- Consumes: `BaseEntity` từ Task 0
- Produces: `User`, `Role`, `UserRepository`, `RoleRepository` cho Task 2 (Auth) và Task 3 (Profile).

- [ ] **Step 1: Viết test cho UserRepository**

```java
package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Role;
import com.fpt.swp391.nutribot.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
class UserRepositoryTest {
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;

    @Test
    void saveAndFindByUsername_shouldWork() {
        Role role = new Role();
        role.setRoleName("ROLE_USER");
        role = roleRepository.save(role);

        User user = new User();
        user.setUsername("testuser");
        user.setEmail("test@nutribot.com");
        user.setPasswordHash("hashed_pwd");
        user.setRole(role);
        user.setStatus("ACTIVE");

        userRepository.save(user);

        assertTrue(userRepository.findByUsername("testuser").isPresent());
        assertTrue(userRepository.existsByEmail("test@nutribot.com"));
    }
}
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `cd backend; ./mvnw test -Dtest=UserRepositoryTest`
Expected: FAIL do chưa có `User`, `Role`, `UserRepository`.

- [ ] **Step 3: Triển khai mã nguồn User & Role**

Tạo `backend/src/main/java/com/fpt/swp391/nutribot/entity/Role.java`:
```java
package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "roles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Role {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "role_id")
    private Integer roleId;

    @Column(name = "role_name", nullable = false, unique = true, length = 50)
    private String roleName;

    @Column(name = "description", length = 255)
    private String description;
}
```

Tạo `backend/src/main/java/com/fpt/swp391/nutribot/entity/User.java`:
```java
package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class User extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Integer userId;

    @Column(name = "username", nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "full_name", length = 150)
    private String fullName;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Column(name = "strike_count", nullable = false)
    private Short strikeCount = 0;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "ACTIVE";
}
```

Tạo `backend/src/main/java/com/fpt/swp391/nutribot/repository/RoleRepository.java`:
```java
package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, Integer> {
    Optional<Role> findByRoleName(String roleName);
}
```

Tạo `backend/src/main/java/com/fpt/swp391/nutribot/repository/UserRepository.java`:
```java
package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Integer> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
}
```

- [ ] **Step 4: Chạy test xác nhận pass**

Run: `cd backend; ./mvnw test -Dtest=UserRepositoryTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/fpt/swp391/nutribot/entity/Role.java backend/src/main/java/com/fpt/swp391/nutribot/entity/User.java backend/src/main/java/com/fpt/swp391/nutribot/repository/RoleRepository.java backend/src/main/java/com/fpt/swp391/nutribot/repository/UserRepository.java backend/src/test/java/com/fpt/swp391/nutribot/repository/UserRepositoryTest.java
git commit -m "feat(auth): add Role, User entities and repositories (Task #3)"
```

---

### Task 2: Domain Trường - Security, JWT Token & Authentication APIs (Tasks #2, #5, #6)

**Files:**
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/config/SecurityConfig.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/config/JwtTokenProvider.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/config/JwtAuthenticationFilter.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/dto/request/RegisterRequest.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/dto/request/LoginRequest.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/dto/response/AuthResponse.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/service/AuthService.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/service/impl/AuthServiceImpl.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/controller/AuthController.java`
- Test: `backend/src/test/java/com/fpt/swp391/nutribot/controller/AuthControllerTest.java`

**Interfaces:**
- Consumes: `UserRepository`, `RoleRepository` từ Task 1
- Produces: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, JWT Filter cho toàn hệ thống.

- [ ] **Step 1: Viết test cho AuthController**

```java
package com.fpt.swp391.nutribot.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fpt.swp391.nutribot.dto.request.RegisterRequest;
import com.fpt.swp391.nutribot.dto.response.AuthResponse;
import com.fpt.swp391.nutribot.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTest {
    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @MockBean
    private AuthService authService;

    @Test
    void register_shouldReturn200AndToken() throws Exception {
        RegisterRequest req = new RegisterRequest("trunguser", "trung@test.com", "Password123!", "Nguyen Van Trung");
        AuthResponse res = new AuthResponse("mock-jwt-token", "trunguser", "ROLE_USER");

        when(authService.register(any())).thenReturn(res);

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.token").value("mock-jwt-token"));
    }
}
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `cd backend; ./mvnw test -Dtest=AuthControllerTest`
Expected: FAIL do chưa có `AuthController` và `AuthService`.

- [ ] **Step 3: Triển khai JWT, SecurityConfig, DTOs, Service & Controller**

Tạo DTOs:
`RegisterRequest.java`:
```java
package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank(message = "Username cannot be blank")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    String username,

    @NotBlank(message = "Email cannot be blank")
    @Email(message = "Invalid email format")
    String email,

    @NotBlank(message = "Password cannot be blank")
    @Size(min = 6, message = "Password must have at least 6 characters")
    String password,

    String fullName
) {}
```

`LoginRequest.java`:
```java
package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
    @NotBlank(message = "Username or email is required")
    String usernameOrEmail,

    @NotBlank(message = "Password is required")
    String password
) {}
```

`AuthResponse.java`:
```java
package com.fpt.swp391.nutribot.dto.response;

public record AuthResponse(
    String token,
    String username,
    String role
) {}
```

Tạo `JwtTokenProvider.java`:
```java
package com.fpt.swp391.nutribot.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Component
public class JwtTokenProvider {
    @Value("${nutribot.jwt.secret}")
    private String jwtSecret;

    @Value("${nutribot.jwt.expiration-ms}")
    private long jwtExpirationMs;

    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    public String generateToken(String username, String role) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationMs);

        return Jwts.builder()
                .setSubject(username)
                .claim("role", role)
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String getUsernameFromJwt(String token) {
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
        return claims.getSubject();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder().setSigningKey(getSigningKey()).build().parseClaimsJws(token);
            return true;
        } catch (Exception ex) {
            return false;
        }
    }
}
```

Tạo `SecurityConfig.java`:
```java
package com.fpt.swp391.nutribot.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**", "/api/v1/blogs/**", "/api/v1/videos/**").permitAll()
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:3000", "http://localhost:5173"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

Tạo `JwtAuthenticationFilter.java`:
```java
package com.fpt.swp391.nutribot.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;

    public JwtAuthenticationFilter(JwtTokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String jwt = getJwtFromRequest(request);

        if (StringUtils.hasText(jwt) && tokenProvider.validateToken(jwt)) {
            String username = tokenProvider.getUsernameFromJwt(jwt);
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    username, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"))
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);
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
}
```

Tạo `AuthService.java` & `AuthServiceImpl.java`:
```java
package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.LoginRequest;
import com.fpt.swp391.nutribot.dto.request.RegisterRequest;
import com.fpt.swp391.nutribot.dto.response.AuthResponse;

public interface AuthService {
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
}
```

```java
package com.fpt.swp391.nutribot.service.impl;

import com.fpt.swp391.nutribot.config.JwtTokenProvider;
import com.fpt.swp391.nutribot.dto.request.LoginRequest;
import com.fpt.swp391.nutribot.dto.request.RegisterRequest;
import com.fpt.swp391.nutribot.dto.response.AuthResponse;
import com.fpt.swp391.nutribot.entity.Role;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.AppException;
import com.fpt.swp391.nutribot.repository.RoleRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public AuthServiceImpl(UserRepository userRepository, RoleRepository roleRepository,
                           PasswordEncoder passwordEncoder, JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new AppException("Username is already taken!", HttpStatus.CONFLICT);
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new AppException("Email is already registered!", HttpStatus.CONFLICT);
        }

        Role userRole = roleRepository.findByRoleName("ROLE_USER")
                .orElseGet(() -> {
                    Role r = new Role();
                    r.setRoleName("ROLE_USER");
                    r.setDescription("Standard user");
                    return roleRepository.save(r);
                });

        User user = new User();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFullName(request.fullName());
        user.setRole(userRole);
        user.setStatus("ACTIVE");
        user.setStrikeCount((short) 0);

        userRepository.save(user);

        String token = tokenProvider.generateToken(user.getUsername(), userRole.getRoleName());
        return new AuthResponse(token, user.getUsername(), userRole.getRoleName());
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.usernameOrEmail())
                .or(() -> userRepository.findByEmail(request.usernameOrEmail()))
                .orElseThrow(() -> new AppException("Invalid username/email or password!", HttpStatus.UNAUTHORIZED));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new AppException("Invalid username/email or password!", HttpStatus.UNAUTHORIZED);
        }

        if ("BANNED".equalsIgnoreCase(user.getStatus()) || "SUSPENDED".equalsIgnoreCase(user.getStatus())) {
            throw new AppException("Account is " + user.getStatus(), HttpStatus.FORBIDDEN);
        }

        String token = tokenProvider.generateToken(user.getUsername(), user.getRole().getRoleName());
        return new AuthResponse(token, user.getUsername(), user.getRole().getRoleName());
    }
}
```

Tạo `AuthController.java`:
```java
package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.LoginRequest;
import com.fpt.swp391.nutribot.dto.request.RegisterRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.AuthResponse;
import com.fpt.swp391.nutribot.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.ok(ApiResponse.ok("Registration successful", response));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.ok("Login successful", response));
    }
}
```

- [ ] **Step 4: Chạy test xác nhận pass**

Run: `cd backend; ./mvnw test -Dtest=AuthControllerTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/fpt/swp391/nutribot/config/ backend/src/main/java/com/fpt/swp391/nutribot/dto/request/ backend/src/main/java/com/fpt/swp391/nutribot/dto/response/AuthResponse.java backend/src/main/java/com/fpt/swp391/nutribot/service/ backend/src/main/java/com/fpt/swp391/nutribot/controller/AuthController.java backend/src/test/java/com/fpt/swp391/nutribot/controller/AuthControllerTest.java
git commit -m "feat(auth): implement JWT security, registration and login APIs (Tasks #2, #5, #6)"
```

---

### Task 3: Domain Thắng Foundation - Entities & Profile/Health APIs với BMI (Tasks #8, #10, #11)

**Files:**
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/entity/UserProfile.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/entity/Ingredient.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/repository/UserProfileRepository.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/repository/IngredientRepository.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/dto/request/HealthProfileUpdateRequest.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/dto/response/UserProfileResponse.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/service/UserProfileService.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/service/impl/UserProfileServiceImpl.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/controller/UserProfileController.java`
- Test: `backend/src/test/java/com/fpt/swp391/nutribot/service/UserProfileServiceTest.java`

**Interfaces:**
- Consumes: `User` từ Task 1, `ApiResponse<T>` từ Task 0.
- Produces: `GET /api/v1/users/profile`, `PUT /api/v1/users/profile`, `PUT /api/v1/users/health-profile` với thuật toán tính BMI tự động.

- [ ] **Step 1: Viết test cho UserProfileService (tính BMI và update profile)**

```java
package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.HealthProfileUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.UserProfileResponse;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.service.impl.UserProfileServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserProfileServiceTest {
    @Mock
    private UserProfileRepository profileRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserProfileServiceImpl profileService;

    @Test
    void calculateBmi_shouldReturnAccurateValue() {
        User user = new User();
        user.setUserId(1);
        user.setUsername("thanguser");

        UserProfile profile = new UserProfile();
        profile.setUserId(1);
        profile.setUser(user);
        profile.setHeightCm(new BigDecimal("170.0")); // 1.7m
        profile.setWeightKg(new BigDecimal("68.0"));  // 68kg -> BMI = 68 / (1.7 * 1.7) = 23.53

        when(userRepository.findByUsername("thanguser")).thenReturn(Optional.of(user));
        when(profileRepository.findById(1)).thenReturn(Optional.of(profile));

        UserProfileResponse res = profileService.getProfile("thanguser");
        assertNotNull(res);
        assertEquals(23.53, res.bmi());
    }
}
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `cd backend; ./mvnw test -Dtest=UserProfileServiceTest`
Expected: FAIL do chưa tạo `UserProfile`, `UserProfileService`.

- [ ] **Step 3: Triển khai mã nguồn UserProfile, Ingredient, Service & Controller**

Tạo `backend/src/main/java/com/fpt/swp391/nutribot/entity/UserProfile.java`:
```java
package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "user_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserProfile {
    @Id
    @Column(name = "user_id")
    private Integer userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "height_cm", precision = 5, scale = 2)
    private BigDecimal heightCm;

    @Column(name = "weight_kg", precision = 5, scale = 2)
    private BigDecimal weightKg;

    @Column(name = "gender", length = 20)
    private String gender;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "health_goal", length = 50)
    private String healthGoal;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @ManyToMany
    @JoinTable(
        name = "user_allergies",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "ingredient_id")
    )
    private Set<Ingredient> allergies = new HashSet<>();
}
```

Tạo `backend/src/main/java/com/fpt/swp391/nutribot/entity/Ingredient.java`:
```java
package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "ingredients")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Ingredient {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ingredient_id")
    private Integer ingredientId;

    @Column(name = "name", nullable = false, unique = true, length = 150)
    private String name;

    @Column(name = "slug", nullable = false, unique = true, length = 180)
    private String slug;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "category_id", nullable = false)
    private Integer categoryId;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
```

Tạo Repositories:
`UserProfileRepository.java`:
```java
package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.UserProfile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserProfileRepository extends JpaRepository<UserProfile, Integer> {
}
```

`IngredientRepository.java`:
```java
package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Ingredient;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IngredientRepository extends JpaRepository<Ingredient, Integer> {
    List<Ingredient> findByIsActiveTrue();
}
```

Tạo DTOs:
`HealthProfileUpdateRequest.java`:
```java
package com.fpt.swp391.nutribot.dto.request;

import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

public record HealthProfileUpdateRequest(
    @DecimalMin(value = "30.0", message = "Height must be at least 30 cm")
    BigDecimal heightCm,

    @DecimalMin(value = "2.0", message = "Weight must be at least 2 kg")
    BigDecimal weightKg,

    String gender,
    LocalDate dateOfBirth,
    String healthGoal,
    Set<Integer> allergyIngredientIds
) {}
```

`UserProfileResponse.java`:
```java
package com.fpt.swp391.nutribot.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

public record UserProfileResponse(
    Integer userId,
    String username,
    String email,
    String fullName,
    BigDecimal heightCm,
    BigDecimal weightKg,
    Double bmi,
    String bmiCategory,
    String gender,
    LocalDate dateOfBirth,
    String healthGoal,
    Set<String> allergyNames
) {}
```

Tạo `UserProfileService.java` & `UserProfileServiceImpl.java`:
```java
package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.HealthProfileUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.UserProfileResponse;

public interface UserProfileService {
    UserProfileResponse getProfile(String username);
    UserProfileResponse updateHealthProfile(String username, HealthProfileUpdateRequest request);
}
```

```java
package com.fpt.swp391.nutribot.service.impl;

import com.fpt.swp391.nutribot.dto.request.HealthProfileUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.UserProfileResponse;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.exception.ResourceNotFoundException;
import com.fpt.swp391.nutribot.repository.IngredientRepository;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.service.UserProfileService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class UserProfileServiceImpl implements UserProfileService {

    private final UserRepository userRepository;
    private final UserProfileRepository profileRepository;
    private final IngredientRepository ingredientRepository;

    public UserProfileServiceImpl(UserRepository userRepository, UserProfileRepository profileRepository,
                                  IngredientRepository ingredientRepository) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.ingredientRepository = ingredientRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));

        UserProfile profile = profileRepository.findById(user.getUserId())
                .orElseGet(() -> {
                    UserProfile p = new UserProfile();
                    p.setUserId(user.getUserId());
                    p.setUser(user);
                    return p;
                });

        return mapToResponse(user, profile);
    }

    @Override
    @Transactional
    public UserProfileResponse updateHealthProfile(String username, HealthProfileUpdateRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));

        UserProfile profile = profileRepository.findById(user.getUserId())
                .orElseGet(() -> {
                    UserProfile p = new UserProfile();
                    p.setUserId(user.getUserId());
                    p.setUser(user);
                    return p;
                });

        profile.setHeightCm(request.heightCm());
        profile.setWeightKg(request.weightKg());
        profile.setGender(request.gender());
        profile.setDateOfBirth(request.dateOfBirth());
        profile.setHealthGoal(request.healthGoal());
        profile.setUpdatedAt(Instant.now());

        if (request.allergyIngredientIds() != null) {
            Set<Ingredient> allergies = new HashSet<>(ingredientRepository.findAllById(request.allergyIngredientIds()));
            profile.setAllergies(allergies);
        }

        profile = profileRepository.save(profile);
        return mapToResponse(user, profile);
    }

    private UserProfileResponse mapToResponse(User user, UserProfile profile) {
        Double bmi = null;
        String bmiCategory = "Unknown";

        if (profile.getHeightCm() != null && profile.getWeightKg() != null
                && profile.getHeightCm().compareTo(BigDecimal.ZERO) > 0) {
            double heightM = profile.getHeightCm().doubleValue() / 100.0;
            double weight = profile.getWeightKg().doubleValue();
            double rawBmi = weight / (heightM * heightM);
            bmi = BigDecimal.valueOf(rawBmi).setScale(2, RoundingMode.HALF_UP).doubleValue();

            if (bmi < 18.5) bmiCategory = "Underweight";
            else if (bmi < 24.9) bmiCategory = "Normal weight";
            else if (bmi < 29.9) bmiCategory = "Overweight";
            else bmiCategory = "Obese";
        }

        Set<String> allergies = profile.getAllergies() == null ? Set.of() :
                profile.getAllergies().stream().map(Ingredient::getName).collect(Collectors.toSet());

        return new UserProfileResponse(
                user.getUserId(),
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                profile.getHeightCm(),
                profile.getWeightKg(),
                bmi,
                bmiCategory,
                profile.getGender(),
                profile.getDateOfBirth(),
                profile.getHealthGoal(),
                allergies
        );
    }
}
```

Tạo `UserProfileController.java`:
```java
package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.HealthProfileUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.UserProfileResponse;
import com.fpt.swp391.nutribot.service.UserProfileService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users/profile")
public class UserProfileController {

    private final UserProfileService profileService;

    public UserProfileController(UserProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<UserProfileResponse>> getMyProfile(Authentication auth) {
        UserProfileResponse response = profileService.getProfile(auth.getName());
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PutMapping("/health")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateHealthProfile(
            Authentication auth,
            @Valid @RequestBody HealthProfileUpdateRequest request) {
        UserProfileResponse response = profileService.updateHealthProfile(auth.getName(), request);
        return ResponseEntity.ok(ApiResponse.ok("Health profile updated successfully", response));
    }
}
```

- [ ] **Step 4: Chạy test xác nhận pass**

Run: `cd backend; ./mvnw test -Dtest=UserProfileServiceTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/fpt/swp391/nutribot/entity/UserProfile.java backend/src/main/java/com/fpt/swp391/nutribot/entity/Ingredient.java backend/src/main/java/com/fpt/swp391/nutribot/repository/UserProfileRepository.java backend/src/main/java/com/fpt/swp391/nutribot/repository/IngredientRepository.java backend/src/main/java/com/fpt/swp391/nutribot/dto/request/HealthProfileUpdateRequest.java backend/src/main/java/com/fpt/swp391/nutribot/dto/response/UserProfileResponse.java backend/src/main/java/com/fpt/swp391/nutribot/service/UserProfileService.java backend/src/main/java/com/fpt/swp391/nutribot/service/impl/UserProfileServiceImpl.java backend/src/main/java/com/fpt/swp391/nutribot/controller/UserProfileController.java backend/src/test/java/com/fpt/swp391/nutribot/service/UserProfileServiceTest.java
git commit -m "feat(profile): implement UserProfile, Ingredient entities and BMI calculation API (Tasks #8, #10, #11)"
```

---

### Task 4: Chạy Toàn Bộ Test Suite & Nghiệm Thu Sprint 1 Backend Foundation

**Files:**
- Test: All tests in `backend/src/test/`

- [ ] **Step 1: Chạy toàn bộ test suite**

Run: `cd backend; ./mvnw clean test`
Expected: All tests PASS, build SUCCESS.

- [ ] **Step 2: Commit và tag mốc hoàn thành Foundation**

```bash
git commit --allow-empty -m "chore(release): complete Phase 0 and Sprint 1 backend foundation"
```
