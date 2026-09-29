package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.AdminUserStatusRequest;
import com.fpt.swp391.nutribot.dto.response.AdminUserResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Role;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử AdminUserService - Quản lý người dùng, State Machine & Bảo vệ Quản trị (BL-015, BL-022, BL-031)")
class AdminUserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AdminUserService adminUserService;

    private Role roleUser;
    private Role roleAdmin;
    private User normalUser;
    private User adminUser;

    @BeforeEach
    void setUp() {
        roleUser = Role.builder().roleId(1).roleName("USER").build();
        roleAdmin = Role.builder().roleId(2).roleName("ADMIN").build();

        normalUser = User.builder()
                .userId(10)
                .username("minh_member")
                .email("minh@example.com")
                .fullName("Nguyen Van Minh")
                .role(roleUser)
                .status(AccountStatus.ACTIVE)
                .strikeCount(0)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        adminUser = User.builder()
                .userId(1)
                .username("super_admin")
                .email("admin@nutribot.com")
                .fullName("Super Admin")
                .role(roleAdmin)
                .status(AccountStatus.ACTIVE)
                .strikeCount(0)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("Lấy danh sách người dùng thành công với phân trang có chặn trần (Bounded Page Size)")
    void getAllUsers_withKeywordAndStatus_callsSpecificationAndReturnsBoundedPage() {
        PageImpl<User> mockPage = new PageImpl<>(List.of(normalUser), Pageable.ofSize(10), 1);
        when(userRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(mockPage);

        PagedResponse<AdminUserResponse> result = adminUserService.getAllUsers("minh", "ACTIVE", 0, 100);

        assertThat(result).isNotNull();
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getUsername()).isEqualTo("minh_member");

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(userRepository).findAll(any(Specification.class), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(50); // Trần tối đa 50
    }

    @Test
    @DisplayName("Admin chuyển trạng thái user thành công sang SUSPENDED kèm lý do kiểm toán (BL-031)")
    void updateUserStatus_success_transitionsStatusAndAudits() {
        when(userRepository.findByIdForUpdate(10)).thenReturn(Optional.of(normalUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminUserStatusRequest request = AdminUserStatusRequest.builder()
                .status("SUSPENDED")
                .reason("Nghi ngờ gian lận đăng bài")
                .build();

        AdminUserResponse response = adminUserService.updateUserStatus(10, request, "super_admin");

        assertThat(response).isNotNull();
        assertThat(response.getStatus()).isEqualTo("SUSPENDED");
        verify(userRepository).save(normalUser);
        assertThat(normalUser.getStatus()).isEqualTo(AccountStatus.SUSPENDED);
    }

    @Test
    @DisplayName("Mở khóa user từ BANNED/SUSPENDED về ACTIVE sẽ reset strikeCount về 0")
    void updateUserStatus_unbanToActive_resetsStrikeCount() {
        normalUser.setStatus(AccountStatus.BANNED);
        normalUser.setStrikeCount(3);
        when(userRepository.findByIdForUpdate(10)).thenReturn(Optional.of(normalUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminUserStatusRequest request = AdminUserStatusRequest.builder()
                .status("ACTIVE")
                .reason("Đã khiếu nại thành công")
                .build();

        AdminUserResponse response = adminUserService.updateUserStatus(10, request, "super_admin");

        assertThat(response.getStatus()).isEqualTo("ACTIVE");
        assertThat(normalUser.getStrikeCount()).isEqualTo(0);
    }

    @Test
    @DisplayName("Admin tự khóa hoặc thay đổi trạng thái chính mình -> Ném BadRequestException (BL-022)")
    void updateUserStatus_selfBan_throwsBadRequestException() {
        when(userRepository.findByIdForUpdate(1)).thenReturn(Optional.of(adminUser));

        AdminUserStatusRequest request = AdminUserStatusRequest.builder()
                .status("SUSPENDED")
                .reason("Tự khóa")
                .build();

        assertThatThrownBy(() -> adminUserService.updateUserStatus(1, request, "super_admin"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Bạn không thể tự thay đổi trạng thái tài khoản của chính mình");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Khóa tài khoản Admin duy nhất còn lại trong hệ thống -> Ném BadRequestException (BL-022)")
    void updateUserStatus_lastActiveAdmin_throwsBadRequestException() {
        User anotherAdmin = User.builder()
                .userId(2)
                .username("second_admin")
                .role(roleAdmin)
                .status(AccountStatus.ACTIVE)
                .build();

        when(userRepository.findByIdForUpdate(2)).thenReturn(Optional.of(anotherAdmin));
        when(userRepository.countActiveAdmins(AccountStatus.ACTIVE)).thenReturn(1L);

        AdminUserStatusRequest request = AdminUserStatusRequest.builder()
                .status("BANNED")
                .reason("Cố tình khóa admin cuối")
                .build();

        assertThatThrownBy(() -> adminUserService.updateUserStatus(2, request, "super_admin"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Không thể khóa tài khoản Quản trị viên duy nhất còn lại");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Kích hoạt tài khoản PENDING_VERIFY lên thẳng ACTIVE chưa xác thực OTP -> Ném BadRequestException (BL-015)")
    void updateUserStatus_pendingVerifyToActive_throwsBadRequestException() {
        normalUser.setStatus(AccountStatus.PENDING_VERIFY);
        when(userRepository.findByIdForUpdate(10)).thenReturn(Optional.of(normalUser));

        AdminUserStatusRequest request = AdminUserStatusRequest.builder()
                .status("ACTIVE")
                .reason("Bypass OTP")
                .build();

        assertThatThrownBy(() -> adminUserService.updateUserStatus(10, request, "super_admin"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Không thể kích hoạt tài khoản chưa qua xác thực email OTP");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Truyền status không hợp lệ -> Ném BadRequestException")
    void updateUserStatus_invalidStatus_throwsBadRequestException() {
        when(userRepository.findByIdForUpdate(10)).thenReturn(Optional.of(normalUser));

        AdminUserStatusRequest request = AdminUserStatusRequest.builder()
                .status("UNKNOWN_STATUS")
                .build();

        assertThatThrownBy(() -> adminUserService.updateUserStatus(10, request, "super_admin"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Trạng thái tài khoản không hợp lệ");
    }

    @Test
    @DisplayName("Không tìm thấy người dùng theo ID -> Ném NotFoundException")
    void updateUserStatus_userNotFound_throwsNotFoundException() {
        when(userRepository.findByIdForUpdate(999)).thenReturn(Optional.empty());

        AdminUserStatusRequest request = AdminUserStatusRequest.builder()
                .status("ACTIVE")
                .build();

        assertThatThrownBy(() -> adminUserService.updateUserStatus(999, request, "super_admin"))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("Không tìm thấy người dùng với ID: 999");
    }
}
