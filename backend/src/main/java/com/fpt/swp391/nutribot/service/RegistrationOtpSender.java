package com.fpt.swp391.nutribot.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RegistrationOtpSender implements EmailOtpSender {

    private final EmailService emailService;

    @Override
    public void sendRegistrationOtp(String recipient, String otp, int expirationMinutes) {
        String subject = "Mã xác thực NutriBot";
        String body = """
                Xin chào,

                Mã xác thực của bạn là: %s

                Mã này có hiệu lực trong %d phút. Vui lòng không chia sẻ mã này với ai.

                Trân trọng,
                NutriBot Team
                """.formatted(otp, expirationMinutes);
        emailService.sendEmail(recipient, subject, body);
    }

    @Override
    public void sendEmailChangeOtp(String recipient, String otp, int expirationMinutes) {
        String subject = "NutriBot email change verification";
        String body = """
                Hello,

                Use this verification code to confirm your new NutriBot email address:

                %s

                This code expires in %d minutes. If you did not request this change, you can ignore this email.

                NutriBot Team
                """.formatted(otp, expirationMinutes);
        emailService.sendEmail(recipient, subject, body);
    }
}
