package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.EmailVerificationResponse;
import com.fpt.swp391.nutribot.entity.EmailOtp;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.ConflictException;
import com.fpt.swp391.nutribot.exception.EmailDeliveryException;
import com.fpt.swp391.nutribot.repository.EmailOtpRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class EmailChangeService {

    private static final int MAX_OTP_ATTEMPTS = 5;

    private final EmailOtpRepository emailOtpRepository;
    private final UserRepository userRepository;
    private final OtpService otpService;

    @Transactional
    public String requestEmailChange(User user, String requestedEmail) {
        String normalizedEmail = requestedEmail.trim().toLowerCase(Locale.ROOT);

        if (normalizedEmail.equalsIgnoreCase(user.getEmail())) {
            emailOtpRepository.findFirstByUserIdAndPurposeAndIsUsedFalseOrderByCreatedAtDesc(
                    user.getUserId(), OtpService.PURPOSE_EMAIL_CHANGE)
                    .ifPresent(emailOtpRepository::delete);
            return null;
        }

        if (userRepository.existsByEmailIgnoreCaseAndUserIdNot(normalizedEmail, user.getUserId())) {
            throw new ConflictException("Email is already in use.");
        }
        if (emailOtpRepository.existsByEmailIgnoreCaseAndPurposeAndIsUsedFalseAndUserIdNot(
                normalizedEmail, OtpService.PURPOSE_EMAIL_CHANGE, user.getUserId())) {
            throw new ConflictException("Email is already pending verification for another account.");
        }

        try {
            otpService.generateAndSendEmailChangeOtp(normalizedEmail, user.getUserId());
        } catch (Exception e) {
            throw new EmailDeliveryException("Unable to send the email verification code.", e);
        }
        return normalizedEmail;
    }

    @Transactional(noRollbackFor = BadRequestException.class)
    public EmailVerificationResponse verifyEmailChange(String currentUsername, String otp) {
        User user = userRepository.findByUsernameForUpdate(currentUsername)
                .orElseThrow(() -> new BadRequestException("Email change request was not found."));
        EmailOtp request = otpService.verifyEmailChangeOtp(user.getUserId(), otp);

        if (userRepository.existsByEmailIgnoreCaseAndUserIdNot(request.getEmail(), user.getUserId())) {
            throw new ConflictException("Email is already in use. Request a different address from your profile.");
        }

        user.setEmail(request.getEmail());
        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Email is already in use. Request a different address from your profile.");
        }
        otpService.deleteOtp(request);
        return EmailVerificationResponse.builder().email(user.getEmail()).build();
    }

    @Transactional(readOnly = true)
    public String getPendingEmail(Integer userId) {
        return emailOtpRepository.findFirstByUserIdAndPurposeAndIsUsedFalseOrderByCreatedAtDesc(userId, OtpService.PURPOSE_EMAIL_CHANGE)
                .filter(request -> request.getExpiresAt().isAfter(java.time.LocalDateTime.now()))
                .map(EmailOtp::getEmail)
                .orElse(null);
    }
}
