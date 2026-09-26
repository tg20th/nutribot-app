package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.config.JwtTokenProvider;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
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

    @InjectMocks
    private UserProfileService userProfileService;

    @Test
    void deleteAvatar_keepsDatabaseRemovalWhenCloudinaryCleanupFails() {
        User user = User.builder()
                .userId(7)
                .username("alice")
                .avatarUrl("https://res.cloudinary.com/example/image/upload/nutribot/avatars/7_photo.jpg")
                .build();
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
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
}
