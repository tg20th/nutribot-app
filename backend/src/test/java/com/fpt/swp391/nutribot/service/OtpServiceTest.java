package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.EmailOtp;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.repository.EmailOtpRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OtpServiceTest {
    @Mock EmailOtpRepository repository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock ObjectProvider<EmailOtpSender> senderProvider;

    private OtpService service() { return new OtpService(repository, passwordEncoder, senderProvider); }

    private EmailOtp otp(boolean used, LocalDateTime expiresAt) {
        return EmailOtp.builder().email("user@example.com").purpose(OtpService.PURPOSE_REGISTRATION)
                .otpHash("hash").isUsed(used).expiresAt(expiresAt).build();
    }

    @Test void wrongCodeOnLiveOtpIsInvalid() {
        when(repository.findFirstByEmailIgnoreCaseAndPurposeOrderByCreatedAtDesc(anyString(), anyString()))
                .thenReturn(Optional.of(otp(false, LocalDateTime.now().plusMinutes(5))));
        when(passwordEncoder.matches("000000", "hash")).thenReturn(false);
        BadRequestException error = assertThrows(BadRequestException.class, () -> service().verifyRegistrationOtp("user@example.com", "000000"));
        assertEquals("Invalid verification code. Please try again.", error.getMessage());
    }

    @Test void expiredCodeIsExpired() {
        when(repository.findFirstByEmailIgnoreCaseAndPurposeOrderByCreatedAtDesc(anyString(), anyString()))
                .thenReturn(Optional.of(otp(false, LocalDateTime.now().minusSeconds(1))));
        BadRequestException error = assertThrows(BadRequestException.class, () -> service().verifyRegistrationOtp("user@example.com", "000000"));
        assertEquals("This verification code has expired. Please request a new one.", error.getMessage());
        verifyNoInteractions(passwordEncoder);
    }

    @Test void usedCodeIsAlreadyUsed() {
        when(repository.findFirstByEmailIgnoreCaseAndPurposeOrderByCreatedAtDesc(anyString(), anyString()))
                .thenReturn(Optional.of(otp(true, LocalDateTime.now().plusMinutes(5))));
        BadRequestException error = assertThrows(BadRequestException.class, () -> service().verifyRegistrationOtp("user@example.com", "000000"));
        assertEquals("This verification code has already been used.", error.getMessage());
        verifyNoInteractions(passwordEncoder);
    }
}
