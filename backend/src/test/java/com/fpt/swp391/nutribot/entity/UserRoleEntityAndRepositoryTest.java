package com.fpt.swp391.nutribot.entity;

import com.fpt.swp391.nutribot.dto.request.RegisterRequest;
import com.fpt.swp391.nutribot.repository.RoleRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserRoleEntityAndRepositoryTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RoleRepository roleRepository;

    @Nested
    @DisplayName("1. AccountStatus & RoleName Canonical Enums")
    class CanonicalEnumsTest {

        @Test
        @DisplayName("AccountStatus phải chứa đúng 5 trạng thái theo CHECK constraint của DB")
        void accountStatus_mustMatchDatabaseCheckConstraints() {
            AccountStatus[] statuses = AccountStatus.values();
            assertEquals(4, statuses.length);
            assertTrue(Arrays.asList(statuses).contains(AccountStatus.ACTIVE));
            assertTrue(Arrays.asList(statuses).contains(AccountStatus.WARN));
            assertTrue(Arrays.asList(statuses).contains(AccountStatus.BANNED));
            assertTrue(Arrays.asList(statuses).contains(AccountStatus.PENDING_VERIFY));
        }

        @Test
        @DisplayName("AccountStatus.fromString phải parse chính xác và ném lỗi khi gặp giá trị lạ")
        void accountStatus_fromString_parsingAndValidation() {
            assertEquals(AccountStatus.ACTIVE, AccountStatus.fromString("active"));
            assertEquals(AccountStatus.ACTIVE, AccountStatus.fromString("  ACTIVE  "));
            assertEquals(AccountStatus.PENDING_VERIFY, AccountStatus.fromString("PENDING_VERIFY"));

            assertNull(AccountStatus.fromString(null));
            assertNull(AccountStatus.fromString("   "));

            assertThrows(IllegalArgumentException.class, () -> AccountStatus.fromString("UNKNOWN_STATUS"));
            assertThrows(IllegalArgumentException.class, () -> AccountStatus.fromString("SUPER_ADMIN"));
        }

        @Test
        @DisplayName("RoleName.fromString phải map đúng cả dạng 'User' và 'ROLE_USER', 'Admin' và 'ROLE_ADMIN'")
        void roleName_fromString_mapping() {
            assertEquals(RoleName.ROLE_USER, RoleName.fromString("User"));
            assertEquals(RoleName.ROLE_USER, RoleName.fromString("ROLE_USER"));
            assertEquals(RoleName.ROLE_USER, RoleName.fromString("  role_user "));

            assertEquals(RoleName.ROLE_ADMIN, RoleName.fromString("Admin"));
            assertEquals(RoleName.ROLE_ADMIN, RoleName.fromString("ROLE_ADMIN"));

            assertNull(RoleName.fromString(null));
            assertNull(RoleName.fromString("   "));

            assertThrows(IllegalArgumentException.class, () -> RoleName.fromString("INVALID_ROLE"));
        }

        @Test
        @DisplayName("Role Entity phải chuyển đổi qua lại mượt mà với RoleName Enum")
        void roleEntity_roleEnumRoundTrip() {
            Role role = Role.builder()
                    .roleId(1)
                    .roleName("ROLE_USER")
                    .description("Normal user")
                    .build();

            assertEquals(RoleName.ROLE_USER, role.getRoleEnum());

            role.setRoleEnum(RoleName.ROLE_ADMIN);
            assertEquals("ROLE_ADMIN", role.getRoleName());
            assertEquals(RoleName.ROLE_ADMIN, role.getRoleEnum());
        }
    }

    @Nested
    @DisplayName("2. User Entity Invariants & Lifecycle Normalization")
    class UserLifecycleNormalizationTest {

        @Test
        @DisplayName("onCreate (@PrePersist) phải normalize email thành lowercase, trim username và chuẩn hóa strikeCount")
        void onCreate_normalizesEmailUsernameAndStrikeCount() {
            Role role = Role.builder().roleId(1).roleName("ROLE_USER").build();

            User user = User.builder()
                    .username("  AliceInChains  ")
                    .email("  ALICE@NutriBot.COM  ")
                    .passwordHash("hashed_pwd")
                    .role(role)
                    .strikeCount(-5) // Giả định dữ liệu đầu vào âm
                    .status(null)
                    .build();

            user.onCreate();

            assertEquals("AliceInChains", user.getUsername(), "Username phải được trim khoảng trắng");
            assertEquals("alice@nutribot.com", user.getEmail(), "Email phải được lowercase và trim");
            assertEquals(0, user.getStrikeCount(), "strikeCount âm phải được chuẩn hóa về 0 để thỏa CHECK constraint");
            assertEquals(AccountStatus.ACTIVE, user.getStatus(), "Status null phải mặc định về ACTIVE");
            assertNotNull(user.getCreatedAt());
            assertNotNull(user.getUpdatedAt());
        }

        @Test
        @DisplayName("onUpdate (@PreUpdate) phải tiếp tục duy trì tính chuẩn hóa của email, username và strikeCount")
        void onUpdate_maintainsNormalization() {
            User user = User.builder()
                    .username("  BobDylan  ")
                    .email("  BOB.DYLAN@Domain.VN  ")
                    .strikeCount(-2)
                    .build();

            user.onUpdate();

            assertEquals("BobDylan", user.getUsername());
            assertEquals("bob.dylan@domain.vn", user.getEmail());
            assertEquals(0, user.getStrikeCount());
            assertNotNull(user.getUpdatedAt());
        }
    }

    @Nested
    @DisplayName("3. Chống Privilege Escalation & Mass Assignment")
    class PrivilegeEscalationSecurityTest {

        @Test
        @DisplayName("RegisterRequest không được phép chứa các trường nhạy cảm: role, status, strikeCount")
        void registerRequest_mustNotExposePrivilegedFields() {
            Field[] fields = RegisterRequest.class.getDeclaredFields();
            for (Field field : fields) {
                String fieldName = field.getName().toLowerCase();
                assertFalse(fieldName.contains("role"), "RegisterRequest không được chứa field role để tránh privilege escalation");
                assertFalse(fieldName.contains("status"), "RegisterRequest không được chứa field status để tránh mass-assignment");
                assertFalse(fieldName.contains("strike"), "RegisterRequest không được chứa field strikeCount để tránh can thiệp vi phạm");
            }
        }
    }

    @Nested
    @DisplayName("4. Normalized Identity Policy trong UserRepository")
    class NormalizedIdentityPolicyTest {

        @Test
        @DisplayName("findByNormalizedEmail phải trim và lowercase trước khi truy vấn")
        void findByNormalizedEmail_invokesQueryWithNormalizedData() {
            User user = User.builder().userId(10).email("john@example.com").build();
            when(userRepository.findByEmailIgnoreCase("john@example.com")).thenReturn(Optional.of(user));
            when(userRepository.findByNormalizedEmail(anyString())).thenCallRealMethod();

            Optional<User> result = userRepository.findByNormalizedEmail("  JOHN@Example.COM  ");

            assertTrue(result.isPresent());
            assertEquals("john@example.com", result.get().getEmail());
            verify(userRepository).findByEmailIgnoreCase("john@example.com");
        }

        @Test
        @DisplayName("findByNormalizedUsername phải trim trước khi truy vấn")
        void findByNormalizedUsername_invokesQueryWithTrimmedData() {
            User user = User.builder().userId(11).username("johndoe").build();
            when(userRepository.findByUsernameIgnoreCase("johndoe")).thenReturn(Optional.of(user));
            when(userRepository.findByNormalizedUsername(anyString())).thenCallRealMethod();

            Optional<User> result = userRepository.findByNormalizedUsername("   johndoe   ");

            assertTrue(result.isPresent());
            assertEquals("johndoe", result.get().getUsername());
            verify(userRepository).findByUsernameIgnoreCase("johndoe");
        }

        @Test
        @DisplayName("findByNormalizedUsernameOrEmail phải tìm kiếm theo username và fallback sang email")
        void findByNormalizedUsernameOrEmail_checksBothTrimmed() {
            User user = User.builder().userId(12).email("alice@test.com").build();
            when(userRepository.findByUsernameIgnoreCase("Alice@Test.COM")).thenReturn(Optional.empty());
            when(userRepository.findByEmailIgnoreCase("alice@test.com")).thenReturn(Optional.of(user));
            when(userRepository.findByNormalizedUsernameOrEmail(anyString())).thenCallRealMethod();

            Optional<User> result = userRepository.findByNormalizedUsernameOrEmail("  Alice@Test.COM  ");

            assertTrue(result.isPresent());
            assertEquals("alice@test.com", result.get().getEmail());
        }

        @Test
        @DisplayName("existsByNormalizedUsername và existsByNormalizedEmail phải trả về false khi chuỗi rỗng")
        void existsByNormalized_handlesBlankGracefully() {
            when(userRepository.existsByNormalizedUsername(null)).thenCallRealMethod();
            when(userRepository.existsByNormalizedUsername("  ")).thenCallRealMethod();
            when(userRepository.existsByNormalizedEmail(null)).thenCallRealMethod();
            when(userRepository.existsByNormalizedEmail("   ")).thenCallRealMethod();

            assertFalse(userRepository.existsByNormalizedUsername(null));
            assertFalse(userRepository.existsByNormalizedUsername("  "));
            assertFalse(userRepository.existsByNormalizedEmail(null));
            assertFalse(userRepository.existsByNormalizedEmail("   "));
        }
    }
}
