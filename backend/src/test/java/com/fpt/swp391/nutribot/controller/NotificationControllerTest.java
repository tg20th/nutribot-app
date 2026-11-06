package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.ForbiddenException;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationControllerTest {

    @Mock
    private NotificationService notificationService;
    @Mock
    private UserRepository userRepository;

    @Test
    void warnAccountCanListNotifications() {
        NotificationController controller = new NotificationController(notificationService, userRepository);
        User user = User.builder().userId(7).username("warn-user").status(AccountStatus.WARN).build();
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated("warn-user", null, java.util.List.of());
        when(userRepository.findByUsernameIgnoreCase("warn-user")).thenReturn(Optional.of(user));

        controller.list(0, 10, authentication);

        verify(notificationService).listMyNotifications(eq(7), eq(0), eq(10));
    }

    @Test
    void bannedAccountCannotListNotifications() {
        NotificationController controller = new NotificationController(notificationService, userRepository);
        User user = User.builder().userId(7).username("banned-user").status(AccountStatus.BANNED).build();
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated("banned-user", null, java.util.List.of());
        when(userRepository.findByUsernameIgnoreCase("banned-user")).thenReturn(Optional.of(user));

        assertThrows(ForbiddenException.class, () -> controller.list(0, 10, authentication));
    }
}
