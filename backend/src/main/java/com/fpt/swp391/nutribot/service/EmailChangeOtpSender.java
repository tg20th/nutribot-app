package com.fpt.swp391.nutribot.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class EmailChangeOtpSender implements EmailOtpSender {

    private final EmailService emailService;

    @Value("${app.email-change.expiration-minutes:30}")
    private long expirationMinutes;

    @Override
    public void sendEmailChangeOtp(String recipient, String otp) {
        String subject = "NutriBot email change verification";
        String body = """
                Hello,

                Use this verification code to confirm your new NutriBot email address:

                %s

                This code expires in %d minutes. If you did not request this change, you can ignore this email.

                NutriBot Team
                """.formatted(otp, expirationMinutes);

        emailService.sendEmailOrThrow(recipient, subject, body);
    }
}
