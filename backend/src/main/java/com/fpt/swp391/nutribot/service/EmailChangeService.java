package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.EmailVerificationResponse;
import com.fpt.swp391.nutribot.entity.EmailChangeRequest;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.ConflictException;
import com.fpt.swp391.nutribot.exception.EmailDeliveryException;
import com.fpt.swp391.nutribot.repository.EmailChangeRequestRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class EmailChangeService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int MAX_OTP_ATTEMPTS = 5;

    private final EmailChangeRequestRepository emailChangeRequestRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectProvider<EmailOtpSender> emailOtpSenderProvider;

    @Value("${app.email-change.expiration-minutes:30}")
    private long expirationMinutes;

    @Transactional
    public String requestEmailChange(User user, String requestedEmail) {
        String normalizedEmail = requestedEmail.trim().toLowerCase(Locale.ROOT);
        LocalDateTime now = LocalDateTime.now();
        emailChangeRequestRepository.deleteByExpiresAtLessThanEqual(now);
        Optional<EmailChangeRequest> pendingRequest = emailChangeRequestRepository.findById(user.getUserId());

        if (normalizedEmail.equalsIgnoreCase(user.getEmail())) {
            pendingRequest.ifPresent(emailChangeRequestRepository::delete);
            return null;
        }

        if (userRepository.existsByEmailIgnoreCaseAndUserIdNot(normalizedEmail, user.getUserId())) {
            throw new ConflictException("Email is already in use.");
        }
        if (emailChangeRequestRepository.existsByPendingEmailIgnoreCaseAndUser_UserIdNot(
                normalizedEmail, user.getUserId())) {
            throw new ConflictException("Email is already pending verification for another account.");
        }

        String otp = generateOtp();
        EmailChangeRequest request = pendingRequest
                .filter(current -> current.getExpiresAt().isAfter(now))
                .orElseGet(() -> EmailChangeRequest.builder()
                        // @MapsId derives this entity's primary key from its User association.
                        // Leave userId null so Spring Data uses persist, not merge, for a new row.
                        .user(user)
                        .build());
        request.setUser(user);
        request.setPendingEmail(normalizedEmail);
        request.setOtpHash(passwordEncoder.encode(otp));
        request.setFailedAttempts(0);
        request.setExpiresAt(now.plusMinutes(expirationMinutes));

        try {
            emailChangeRequestRepository.saveAndFlush(request);
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Email is already in use or pending verification.");
        }

        EmailOtpSender sender = emailOtpSenderProvider.getIfAvailable();
        if (sender == null) {
            // The OTP delivery team can implement this port without changing
            // ownership, persistence, expiry, or verification logic.
            throw new EmailDeliveryException("Email OTP delivery is not configured yet.");
        }
        try {
            sender.sendEmailChangeOtp(normalizedEmail, otp);
        } catch (RuntimeException exception) {
            throw new EmailDeliveryException("Unable to send the email verification code.", exception);
        }
        return normalizedEmail;
    }

    @Transactional(noRollbackFor = BadRequestException.class)
    public EmailVerificationResponse verifyEmailChange(String currentUsername, String otp) {
        User user = userRepository.findByUsernameForUpdate(currentUsername)
                .orElseThrow(() -> new BadRequestException("Email change request was not found."));
        EmailChangeRequest request = emailChangeRequestRepository.findById(user.getUserId())
                .orElseThrow(() -> new BadRequestException("Email change request was not found."));

        if (!request.getExpiresAt().isAfter(LocalDateTime.now())) {
            emailChangeRequestRepository.delete(request);
            throw new BadRequestException("Verification code expired. Request a new code from your profile.");
        }

        if (!passwordEncoder.matches(otp, request.getOtpHash())) {
            int failedAttempts = request.getFailedAttempts() + 1;
            if (failedAttempts >= MAX_OTP_ATTEMPTS) {
                emailChangeRequestRepository.delete(request);
                throw new BadRequestException("Too many incorrect codes. Request a new code from your profile.");
            }
            request.setFailedAttempts(failedAttempts);
            emailChangeRequestRepository.saveAndFlush(request);
            throw new BadRequestException("Verification code is incorrect.");
        }

        if (userRepository.existsByEmailIgnoreCaseAndUserIdNot(request.getPendingEmail(), user.getUserId())) {
            throw new ConflictException("Email is already in use. Request a different address from your profile.");
        }

        user.setEmail(request.getPendingEmail());
        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Email is already in use. Request a different address from your profile.");
        }
        emailChangeRequestRepository.delete(request);
        return EmailVerificationResponse.builder().email(user.getEmail()).build();
    }

    @Transactional(readOnly = true)
    public String getPendingEmail(Integer userId) {
        return emailChangeRequestRepository.findById(userId)
                .filter(request -> request.getExpiresAt().isAfter(LocalDateTime.now()))
                .map(EmailChangeRequest::getPendingEmail)
                .orElse(null);
    }

    private String generateOtp() {
        return String.format(Locale.ROOT, "%06d", SECURE_RANDOM.nextInt(1_000_000));
    }
}
