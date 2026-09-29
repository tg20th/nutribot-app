package com.fpt.swp391.nutribot.service;

/**
 * Delivery port for the email OTP integration. Implementations should send
 * the supplied code to the requested address and must not persist or log it.
 */
public interface EmailOtpSender {

    void sendRegistrationOtp(String recipient, String otp, int expirationMinutes);

    void sendEmailChangeOtp(String recipient, String otp, int expirationMinutes);
}
