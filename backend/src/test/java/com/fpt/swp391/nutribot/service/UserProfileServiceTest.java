package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.config.JwtTokenProvider;
import com.fpt.swp391.nutribot.dto.request.PasswordUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.UserProfileResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Role;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserProfileServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private UserProfileRepository userProfileRepository;
    @Mock
    private CloudinaryAvatarService cloudinaryAvatarService;
    @Mock
    private JwtTokenProvider jwtTokenProvider;
    @Mock
    private EmailChangeService emailChangeService;
    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserProfileService userProfileService;

    @Test
    void deleteAvatar_keepsDatabaseRemovalWhenCloudinaryCleanupFails() {
        User user = User.builder()
                .userId(7)
                .username("alice")
                .avatarUrl("https://res.cloudinary.com/example/image/upload/nutribot/avatars/7_photo.jpg")
                .build();
        when(userRepository.findByUsernameForUpdate("alice")).thenReturn(Optional.of(user));
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new IllegalStateException("Cloudinary unavailable"))
                .when(cloudinaryAvatarService).deleteAvatarByUrl(user.getAvatarUrl());

        assertThatCode(() -> userProfileService.deleteAvatar("alice"))
                .doesNotThrowAnyException();

        assertThat(user.getAvatarUrl()).isNull();
        verify(userRepository).saveAndFlush(user);
        verify(cloudinaryAvatarService).deleteAvatarByUrl(
                "https://res.cloudinary.com/example/image/upload/nutribot/avatars/7_photo.jpg");
    }

    @Test
    void changePassword_success_forLocalUserWithValidCurrentPassword() {
        Role role = Role.builder().roleId(1).roleName("ROLE_USER").build();
        User user = User.builder()
                .userId(1)
                .username("jenniekim")
                .email("jenniekim@example.com")
                .passwordHash("hashedOldPassword")
                .role(role)
                .status(AccountStatus.ACTIVE)
                .authProvider("LOCAL")
                .hasPassword(true)
                .build();

        PasswordUpdateRequest request = PasswordUpdateRequest.builder()
                .currentPassword("OldPass@123")
                .newPassword("NewPass@456")
                .confirmPassword("NewPass@456")
                .build();

        when(userRepository.findByUsernameForUpdate("jenniekim")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("OldPass@123", "hashedOldPassword")).thenReturn(true);
        when(passwordEncoder.matches("NewPass@456", "hashedOldPassword")).thenReturn(false);
        when(passwordEncoder.encode("NewPass@456")).thenReturn("hashedNewPassword");
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userProfileRepository.findById(1)).thenReturn(Optional.empty());

        UserProfileResponse response = userProfileService.changePassword("jenniekim", request);

        assertThat(response).isNotNull();
        assertThat(response.getHasPassword()).isTrue();
        assertThat(user.getPasswordHash()).isEqualTo("hashedNewPassword");
        verify(userRepository).saveAndFlush(user);
    }

    @Test
    void changePassword_success_forGoogleOAuthUserWithoutCurrentPassword() {
        Role role = Role.builder().roleId(1).roleName("ROLE_USER").build();
        User user = User.builder()
                .userId(61)
                .username("truong_google")
                .email("truong@gmail.com")
                .passwordHash("randomHashedPassword")
                .role(role)
                .status(AccountStatus.ACTIVE)
                .authProvider("GOOGLE")
                .hasPassword(false)
                .build();

        // Với Google OAuth user chưa có password: currentPassword = null hoặc rỗng
        PasswordUpdateRequest request = PasswordUpdateRequest.builder()
                .currentPassword(null)
                .newPassword("MyNewSecurePass@123")
                .confirmPassword("MyNewSecurePass@123")
                .build();

        when(userRepository.findByUsernameForUpdate("truong_google")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("MyNewSecurePass@123")).thenReturn("encodedNewPass");
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userProfileRepository.findById(61)).thenReturn(Optional.empty());

        UserProfileResponse response = userProfileService.changePassword("truong_google", request);

        assertThat(response).isNotNull();
        assertThat(response.getHasPassword()).isTrue();
        assertThat(response.getAuthProvider()).isEqualTo("GOOGLE");
        assertThat(user.getHasPassword()).isTrue();
        assertThat(user.getPasswordHash()).isEqualTo("encodedNewPass");
    }

    @Test
    void changePassword_fails_whenPasswordsDoNotMatch() {
        PasswordUpdateRequest request = PasswordUpdateRequest.builder()
                .currentPassword("OldPass@123")
                .newPassword("NewPass@456")
                .confirmPassword("DifferentPass@456")
                .build();

        assertThatThrownBy(() -> userProfileService.changePassword("jenniekim", request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Mật khẩu xác nhận không khớp");
    }

    @Test
    void changePassword_fails_whenLocalUserProvidesWrongCurrentPassword() {
        User user = User.builder()
                .userId(1)
                .username("jenniekim")
                .passwordHash("hashedOldPassword")
                .hasPassword(true)
                .build();

        PasswordUpdateRequest request = PasswordUpdateRequest.builder()
                .currentPassword("WrongPass@123")
                .newPassword("NewPass@456")
                .confirmPassword("NewPass@456")
                .build();

        when(userRepository.findByUsernameForUpdate("jenniekim")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("WrongPass@123", "hashedOldPassword")).thenReturn(false);

        assertThatThrownBy(() -> userProfileService.changePassword("jenniekim", request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Mật khẩu hiện tại không chính xác");
    }
}
