package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.repository.EmailOtpRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Transactional;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailChangeOtpReplacementTest {
    @Mock EmailOtpRepository otpRepository;
    @Mock UserRepository userRepository;
    @Mock OtpService otpService;

    @Test
    void requestEmailChangeLocksUserBeforeReplacingActiveOtp() {
        User user = User.builder().userId(68).email("old@example.com").build();
        when(userRepository.findByIdForUpdate(68)).thenReturn(java.util.Optional.of(user));

        EmailChangeService service = new EmailChangeService(otpRepository, userRepository, otpService);
        service.requestEmailChange(user, "new@example.com");

        verify(userRepository).findByIdForUpdate(68);
        verify(otpService).generateAndSendEmailChangeOtp("new@example.com", 68);
        verify(otpRepository).existsByEmailIgnoreCaseAndPurposeAndIsUsedFalseAndUserIdNot(
                "new@example.com", OtpService.PURPOSE_EMAIL_CHANGE, 68);
    }

    @Test
    void verificationFailuresAreNotConvertedToDeliveryFailures() {
        User user = User.builder().userId(68).email("old@example.com").build();
        when(userRepository.findByIdForUpdate(68)).thenReturn(java.util.Optional.of(user));
        doThrow(new com.fpt.swp391.nutribot.exception.BadRequestException(
                "Invalid verification code. Please try again."))
                .when(otpService).generateAndSendEmailChangeOtp("new@example.com", 68);

        EmailChangeService service = new EmailChangeService(otpRepository, userRepository, otpService);
        org.junit.jupiter.api.Assertions.assertThrows(
                com.fpt.swp391.nutribot.exception.BadRequestException.class,
                () -> service.requestEmailChange(user, "new@example.com"));
        verify(otpService).generateAndSendEmailChangeOtp("new@example.com", 68);
    }

    @Test
    void otpValidationDoesNotMarkTheSharedTransactionForRollback() throws Exception {
        Transactional annotation = OtpService.class.getMethod("verifyEmailChangeOtp", Integer.class, String.class)
                .getAnnotation(Transactional.class);
        org.junit.jupiter.api.Assertions.assertArrayEquals(
                new Class<?>[]{com.fpt.swp391.nutribot.exception.BadRequestException.class},
                annotation.noRollbackFor());
    }
}
