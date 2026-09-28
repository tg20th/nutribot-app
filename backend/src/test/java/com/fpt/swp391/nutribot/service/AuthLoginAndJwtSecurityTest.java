package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.config.JwtTokenProvider;
import com.fpt.swp391.nutribot.dto.request.LoginRequest;
import com.fpt.swp391.nutribot.dto.response.AuthResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Role;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.repository.RoleRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthLoginAndJwtSecurityTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private OtpService otpService;

    @InjectMocks
    private AuthService authService;

    private Role userRole;
    private User activeUser;

    @BeforeEach
    void setUp() {
        userRole = Role.builder()
                .roleId(1)
                .roleName("ROLE_USER")
                .build();

        activeUser = User.builder()
                .userId(100)
                .username("testuser")
                .email("testuser@nutribot.com")
                .passwordHash("hashed_password_123")
                .role(userRole)
                .status(AccountStatus.ACTIVE)
                .strikeCount(0)
                .build();
    }

    @Nested
    @DisplayName("1. BL-003: Chống dò quét danh tính (User Enumeration Protection)")
    class UserEnumerationProtectionTest {

        @Test
        @DisplayName("Tài khoản không tồn tại và sai mật khẩu phải trả về cùng class lỗi và cùng message")
        void unknownUser_and_wrongPassword_returnSameErrorMessage() {
            // Case A: User không tồn tại
            when(userRepository.findByNormalizedUsernameOrEmail("nonexistent")).thenReturn(Optional.empty());

            BadRequestException exUnknown = assertThrows(BadRequestException.class, () ->
                    authService.login(new LoginRequest("nonexistent", "Password@123"))
            );

            // Case B: User tồn tại nhưng sai mật khẩu
            when(userRepository.findByNormalizedUsernameOrEmail("testuser")).thenReturn(Optional.of(activeUser));
            when(passwordEncoder.matches("WrongPassword@123", activeUser.getPasswordHash())).thenReturn(false);

            BadRequestException exWrongPass = assertThrows(BadRequestException.class, () ->
                    authService.login(new LoginRequest("testuser", "WrongPassword@123"))
            );

            assertEquals("Tài khoản hoặc mật khẩu không chính xác", exUnknown.getMessage(),
                    "Thông báo lỗi user không tồn tại phải được bảo vệ chung");
            assertEquals("Tài khoản hoặc mật khẩu không chính xác", exWrongPass.getMessage(),
                    "Thông báo lỗi sai mật khẩu phải giống hệt thông báo user không tồn tại");
            assertEquals(exUnknown.getClass(), exWrongPass.getClass(),
                    "Phải cùng một exception class để tránh hacker phân biệt response status");
        }
    }

    @Nested
    @DisplayName("2. BL-026: Kiểm soát trạng thái tài khoản khi đăng nhập & Runtime Revocation")
    class AccountStatusPolicyTest {

        @Test
        @DisplayName("Tài khoản PENDING_VERIFY phải bị chặn đăng nhập và yêu cầu xác thực email")
        void pendingVerifyUser_isDeniedLogin() {
            activeUser.setStatus(AccountStatus.PENDING_VERIFY);
            when(userRepository.findByNormalizedUsernameOrEmail("testuser")).thenReturn(Optional.of(activeUser));
            when(passwordEncoder.matches("Password@123", activeUser.getPasswordHash())).thenReturn(true);

            BadRequestException ex = assertThrows(BadRequestException.class, () ->
                    authService.login(new LoginRequest("testuser", "Password@123"))
            );

            assertTrue(ex.getMessage().contains("chưa xác thực email"));
            verify(jwtTokenProvider, never()).generateToken(anyString(), anyString());
        }

        @Test
        @DisplayName("Tài khoản SUSPENDED hoặc BANNED phải bị chặn cấp JWT token")
        void suspendedOrBannedUser_isDeniedLogin() {
            activeUser.setStatus(AccountStatus.BANNED);
            when(userRepository.findByNormalizedUsernameOrEmail("testuser")).thenReturn(Optional.of(activeUser));
            when(passwordEncoder.matches("Password@123", activeUser.getPasswordHash())).thenReturn(true);

            BadRequestException ex = assertThrows(BadRequestException.class, () ->
                    authService.login(new LoginRequest("testuser", "Password@123"))
            );

            assertTrue(ex.getMessage().contains("khóa") || ex.getMessage().contains("tạm ngưng"));
            verify(jwtTokenProvider, never()).generateToken(anyString(), anyString());
        }

        @Test
        @DisplayName("getRoleNameByUsername chỉ trả về role cho user ACTIVE, tự động thu hồi quyền của user BANNED")
        void getRoleNameByUsername_filtersOutNonActiveUsers() {
            // Khi user đang ACTIVE
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(activeUser));
            Optional<String> activeRole = authService.getRoleNameByUsername("testuser");
            assertTrue(activeRole.isPresent());
            assertEquals("ROLE_USER", activeRole.get());

            // Khi user bị Admin đổi sang BANNED ở DB sau khi đã có token
            activeUser.setStatus(AccountStatus.BANNED);
            Optional<String> bannedRole = authService.getRoleNameByUsername("testuser");
            assertTrue(bannedRole.isEmpty(), "User BANNED phải bị thu hồi quyền ngay lập tức trong filter");
        }
    }

    @Nested
    @DisplayName("3. Đăng nhập thành công và cấp phát Token")
    class SuccessfulLoginTest {

        @Test
        @DisplayName("Thông tin hợp lệ và ACTIVE cấp phát token JWT thành công")
        void validCredentials_issuesTokenSuccessfully() {
            when(userRepository.findByNormalizedUsernameOrEmail("testuser")).thenReturn(Optional.of(activeUser));
            when(passwordEncoder.matches("ValidPassword@123", activeUser.getPasswordHash())).thenReturn(true);
            when(jwtTokenProvider.generateToken("testuser", "ROLE_USER")).thenReturn("mocked.jwt.token");

            AuthResponse response = authService.login(new LoginRequest("testuser", "ValidPassword@123"));

            assertNotNull(response);
            assertEquals("mocked.jwt.token", response.getToken());
            assertEquals("testuser", response.getUsername());
            assertEquals("ROLE_USER", response.getRole());
            verify(jwtTokenProvider).generateToken("testuser", "ROLE_USER");
        }
    }

    @Nested
    @DisplayName("4. BL-027: Kiểm tra tính hợp lệ của JWT Signing Secret")
    class JwtSecretValidationTest {

        @Test
        @DisplayName("JwtTokenProvider phải từ chối khởi động nếu thiếu signing secret hoặc secret quá ngắn")
        void validateSecret_rejectsMissingOrShortSecrets() {
            JwtTokenProvider provider = new JwtTokenProvider();

            // Case A: Missing secret (null hoặc rỗng)
            ReflectionTestUtils.setField(provider, "jwtSecret", "");
            assertThrows(IllegalStateException.class, provider::validateSecret);

            ReflectionTestUtils.setField(provider, "jwtSecret", null);
            assertThrows(IllegalStateException.class, provider::validateSecret);

            // Case B: Secret không đủ 64 bytes (512 bits) cho HS512 (ví dụ Base64 của chuỗi ngắn)
            // "c2hvcnRfc2VjcmV0" giải mã ra chỉ có 12 bytes
            ReflectionTestUtils.setField(provider, "jwtSecret", "c2hvcnRfc2VjcmV0");
            assertThrows(IllegalStateException.class, provider::validateSecret);

            // Case C: Secret hợp lệ (Base64 >= 64 bytes)
            String validSecret = "rAOa9otcvyPSPLqACB1miadHrc9wsmiHkpX+vkJ+1lROA3m0pOAXCVsy2bVUoAlJadI/ZKNGIW+nLxyaA/Fmiw==";
            ReflectionTestUtils.setField(provider, "jwtSecret", validSecret);
            assertDoesNotThrow(provider::validateSecret);
        }
    }
}
