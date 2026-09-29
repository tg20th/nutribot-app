package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.EmailOtp;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.repository.EmailOtpRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class OtpService {

    public static final String PURPOSE_REGISTRATION = "REGISTRATION";
    public static final String PURPOSE_EMAIL_CHANGE = "EMAIL_CHANGE";

    private static final int OTP_LENGTH = 6;
    private static final int OTP_VALID_MINUTES = 5;
    private static final int EMAIL_CHANGE_VALID_MINUTES = 30;

    private final EmailOtpRepository emailOtpRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectProvider<EmailOtpSender> emailOtpSenderProvider;

    /**
     * Tạo OTP mới và gửi email cho REGISTRATION.
     */
    @Transactional
    public void generateAndSendRegistrationOtp(String email) {
        emailOtpRepository.deleteExpiredOrUsed(LocalDateTime.now());

        String otp = generateOtp();

        EmailOtp emailOtp = EmailOtp.builder()
                .email(email.toLowerCase(Locale.ROOT))
                .otpHash(passwordEncoder.encode(otp))
                .purpose(PURPOSE_REGISTRATION)
                .expiresAt(LocalDateTime.now().plusMinutes(OTP_VALID_MINUTES))
                .build();
        emailOtpRepository.save(emailOtp);

        sendOtpViaSender(email, otp, PURPOSE_REGISTRATION, OTP_VALID_MINUTES);
    }

    /**
     * Tạo OTP mới và gửi email cho EMAIL_CHANGE.
     */
    @Transactional
    public void generateAndSendEmailChangeOtp(String email, Integer userId) {
        LocalDateTime now = LocalDateTime.now();
        emailOtpRepository.deleteExpiredEmailChanges(now);

        String otp = generateOtp();

        EmailOtp emailOtp = EmailOtp.builder()
                .email(email.toLowerCase(Locale.ROOT))
                .otpHash(passwordEncoder.encode(otp))
                .purpose(PURPOSE_EMAIL_CHANGE)
                .userId(userId)
                .expiresAt(now.plusMinutes(EMAIL_CHANGE_VALID_MINUTES))
                .build();
        emailOtpRepository.save(emailOtp);

        sendOtpViaSender(email, otp, PURPOSE_EMAIL_CHANGE, EMAIL_CHANGE_VALID_MINUTES);
    }

    /**
     * Verify OTP cho REGISTRATION: đúng → đánh dấu đã dùng.
     */
    @Transactional
    public void verifyRegistrationOtp(String email, String otp) {
        EmailOtp emailOtp = emailOtpRepository
                .findAllByEmailIgnoreCaseAndPurposeAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                        email, PURPOSE_REGISTRATION, LocalDateTime.now())
                .stream()
                .filter(candidate -> passwordEncoder.matches(otp, candidate.getOtpHash()))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Mã OTP không hợp lệ hoặc đã hết hạn"));

        emailOtp.setIsUsed(true);
        emailOtpRepository.save(emailOtp);
    }

    /**
     * Verify OTP cho EMAIL_CHANGE: đúng → trả về record để xử lý tiếp.
     */
    @Transactional(readOnly = true)
    public EmailOtp verifyEmailChangeOtp(Integer userId, String otp) {
        return emailOtpRepository
                .findFirstByUserIdAndPurposeAndIsUsedFalseOrderByCreatedAtDesc(userId, PURPOSE_EMAIL_CHANGE)
                .filter(emailOtp -> !emailOtp.getExpiresAt().isBefore(LocalDateTime.now()))
                .filter(emailOtp -> passwordEncoder.matches(otp, emailOtp.getOtpHash()))
                .orElseThrow(() -> new BadRequestException("Mã OTP không hợp lệ hoặc đã hết hạn"));
    }

    /**
     * Mark OTP as used (dùng cho EMAIL_CHANGE sau khi verify thành công).
     */
    @Transactional
    public void markOtpAsUsed(EmailOtp emailOtp) {
        emailOtp.setIsUsed(true);
        emailOtpRepository.save(emailOtp);
    }

    /**
     * Xóa OTP (dùng cho EMAIL_CHANGE sau khi thay đổi email thành công).
     */
    @Transactional
    public void deleteOtp(EmailOtp emailOtp) {
        emailOtpRepository.delete(emailOtp);
    }

    private String generateOtp() {
        return String.format(Locale.ROOT, "%06d", new Random().nextInt(1_000_000));
    }

    @Async
    private void sendOtpViaSender(String email, String otp, String purpose, int expirationMinutes) {
        EmailOtpSender sender = emailOtpSenderProvider.getIfAvailable();
        if (sender == null) {
            log.warn("EmailOtpSender not configured, OTP for {} purpose not sent", purpose);
            return;
        }
        try {
            if (PURPOSE_REGISTRATION.equals(purpose)) {
                sender.sendRegistrationOtp(email, otp, expirationMinutes);
            } else {
                sender.sendEmailChangeOtp(email, otp, expirationMinutes);
            }
        } catch (RuntimeException e) {
            log.error("Failed to send OTP email to {} for purpose {}", email, purpose, e);
        }
    }
}
