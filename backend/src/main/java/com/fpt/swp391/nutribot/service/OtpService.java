package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.EmailOtp;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.repository.EmailOtpRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class OtpService {

    private static final int OTP_LENGTH = 6;
    private static final int OTP_VALID_MINUTES = 5;
    private static final int MAX_RESEND_PER_15MIN = 3;

    private final EmailOtpRepository emailOtpRepository;
    private final EmailService emailService;

    /**
     * Tạo OTP mới và gửi email.
     * Xóa các OTP cũ của email đó trước khi tạo mới.
     */
    @Transactional
    public void generateAndSendOtp(String email) {
        // Xóa OTP cũ của email này
        emailOtpRepository.deleteExpiredOrUsed(LocalDateTime.now());

        // Tạo mã OTP 6 số ngẫu nhiên
        String otpCode = generateOtpCode();

        // Lưu vào DB
        EmailOtp otp = EmailOtp.builder()
                .email(email)
                .otpCode(otpCode)
                .expiresAt(LocalDateTime.now().plusMinutes(OTP_VALID_MINUTES))
                .build();
        emailOtpRepository.save(otp);

        // Gửi email
        sendOtpEmail(email, otpCode);
    }

    /**
     * Verify OTP: đúng → đánh dấu đã dùng → xóa.
     * Sai hoặc hết hạn → ném exception.
     */
    @Transactional
    public void verifyOtp(String email, String otpCode) {
        EmailOtp otp = emailOtpRepository
                .findByEmailAndOtpCodeAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                        email, otpCode, LocalDateTime.now())
                .orElseThrow(() -> new BadRequestException("Mã OTP không hợp lệ hoặc đã hết hạn"));

        // Đánh dấu đã dùng
        otp.setIsUsed(true);
        emailOtpRepository.save(otp);
    }

    /**
     * Tạo mã OTP 6 chữ số ngẫu nhiên.
     */
    private String generateOtpCode() {
        Random random = new Random();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < OTP_LENGTH; i++) {
            sb.append(random.nextInt(10));
        }
        return sb.toString();
    }

    /**
     * Gửi email chứa mã OTP.
     * Dev: log ra console.
     * Prod: cấu hình SMTP trong application.properties.
     */
    @Async
    public void sendOtpEmail(String email, String otpCode) {
        String subject = "Mã xác thực NutriBot";
        String body = """
                Xin chào,

                Mã xác thực của bạn là: %s

                Mã này có hiệu lực trong %d phút. Vui lòng không chia sẻ mã này với ai.

                Trân trọng,
                NutriBot Team
                """.formatted(otpCode, OTP_VALID_MINUTES);

        emailService.sendEmail(email, subject, body);
    }
}