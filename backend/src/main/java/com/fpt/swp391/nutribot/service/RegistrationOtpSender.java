package com.fpt.swp391.nutribot.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RegistrationOtpSender implements EmailOtpSender {

    private final EmailService emailService;

    @Override
    public void sendRegistrationOtp(String recipient, String otp, int expirationMinutes) {
        String subject = "Your NutriBot Verification Code";
        String htmlBody = buildRegistrationOtpHtml(otp, expirationMinutes);
        emailService.sendHtmlEmail(recipient, subject, htmlBody);
    }

    private String buildRegistrationOtpHtml(String otp, int expirationMinutes) {
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>NutriBot Verification Code</title>
            </head>
            <body style="margin:0;padding:0;background-color:#f8f8f3;font-family:'Outfit',Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f8f3;padding:40px 20px;">
                <tr>
                  <td align="center">
                    <table width="100%%" cellpadding="0" cellspacing="0" border="0"
                           style="max-width:480px;width:100%%;background-color:#fffefa;border-radius:18px;overflow:hidden;
                                  box-shadow:0 8px 32px rgba(49,92,43,0.10);">

                      <!-- Header -->
                      <tr>
                        <td style="background-color:#315c2b;padding:28px 36px;text-align:center;">
                          <p style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:32px;font-weight:600;
                                     color:#fffefa;letter-spacing:-0.5px;">
                            NutriBot
                          </p>
                          <p style="margin:6px 0 0;font-size:10px;letter-spacing:0.18em;color:#eaf2df;
                                     text-transform:uppercase;font-weight:600;">
                            Personalized Nutrition for You
                          </p>
                        </td>
                      </tr>

                      <!-- Body -->
                      <tr>
                        <td style="padding:36px 36px 28px;">
                          <h1 style="margin:0 0 8px;font-family:'Playfair Display',Georgia,serif;font-size:26px;
                                     font-weight:500;color:#25231f;letter-spacing:-0.03em;">
                            Hello!
                          </h1>
                          <p style="margin:0 0 6px;color:#6e6a63;font-size:15px;line-height:1.6;">
                            Your verification code is:
                          </p>

                          <!-- OTP Box -->
                          <table cellpadding="0" cellspacing="0" border="0" width="100%%"
                                 style="margin:24px 0;background-color:#eaf2df;border-radius:12px;border:1px solid #c8dac2;">
                            <tr>
                              <td align="center" style="padding:22px 20px;">
                                <span style="font-family:'Outfit',Arial,sans-serif;font-size:42px;font-weight:700;
                                             color:#315c2b;letter-spacing:10px;display:block;">
                                  %s
                                </span>
                              </td>
                            </tr>
                          </table>

                          <p style="margin:0 0 20px;color:#6e6a63;font-size:13px;line-height:1.6;">
                            This code expires in <strong style="color:#315c2b;">%d minutes</strong>.
                            Please do not share this code with anyone.
                          </p>

                          <!-- Warning -->
                          <table cellpadding="0" cellspacing="0" border="0"
                                 style="background-color:#fdf6e3;border-radius:8px;border-left:3px solid #e8a020;">
                            <tr>
                              <td style="padding:12px 14px;">
                                <p style="margin:0;font-size:12px;color:#7a5c10;line-height:1.5;">
                                  <strong>&#9888; Security Notice:</strong> NutriBot will never ask you
                                  for this code over the phone or via message.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Divider -->
                      <tr>
                        <td style="padding:0 36px;">
                          <table cellpadding="0" cellspacing="0" border="0" width="100%%">
                            <tr>
                              <td style="border-top:1px solid #deded5;"></td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="padding:20px 36px 32px;text-align:center;">
                          <p style="margin:0 0 4px;font-size:13px;color:#6e6a63;">
                            Best regards,
                          </p>
                          <p style="margin:0 0 12px;font-family:'Playfair Display',Georgia,serif;font-size:16px;
                                     font-weight:600;color:#315c2b;letter-spacing:-0.02em;">
                            NutriBot Team
                          </p>
                          <p style="margin:0;font-size:11px;color:#9e9a93;line-height:1.5;">
                            If you did not request this, please ignore this email.
                          </p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """.formatted(otp, expirationMinutes);
    }

    @Override
    public void sendEmailChangeOtp(String recipient, String otp, int expirationMinutes) {
        String subject = "Xác thực đổi email - NutriBot";
        String htmlBody = buildEmailChangeOtpHtml(otp, expirationMinutes);
        emailService.sendHtmlEmail(recipient, subject, htmlBody);
    }

    private String buildEmailChangeOtpHtml(String otp, int expirationMinutes) {
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>NutriBot Email Change Verification</title>
            </head>
            <body style="margin:0;padding:0;background-color:#f8f8f3;font-family:'Outfit',Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f8f3;padding:40px 20px;">
                <tr>
                  <td align="center">
                    <table width="100%%" cellpadding="0" cellspacing="0" border="0"
                           style="max-width:480px;width:100%%;background-color:#fffefa;border-radius:18px;overflow:hidden;
                                  box-shadow:0 8px 32px rgba(49,92,43,0.10);">

                      <!-- Header -->
                      <tr>
                        <td style="background-color:#315c2b;padding:28px 36px;text-align:center;">
                          <p style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:32px;font-weight:600;
                                     color:#fffefa;letter-spacing:-0.5px;">
                            NutriBot
                          </p>
                          <p style="margin:6px 0 0;font-size:10px;letter-spacing:0.18em;color:#eaf2df;
                                     text-transform:uppercase;font-weight:600;">
                            Personalized Nutrition for You
                          </p>
                        </td>
                      </tr>

                      <!-- Body -->
                      <tr>
                        <td style="padding:36px 36px 28px;">
                          <h1 style="margin:0 0 8px;font-family:'Playfair Display',Georgia,serif;font-size:26px;
                                     font-weight:500;color:#25231f;letter-spacing:-0.03em;">
                            Verify Your Email Change
                          </h1>
                          <p style="margin:0 0 6px;color:#6e6a63;font-size:15px;line-height:1.6;">
                            Use this verification code to confirm your new email address:
                          </p>

                          <!-- OTP Box -->
                          <table cellpadding="0" cellspacing="0" border="0" width="100%%"
                                 style="margin:24px 0;background-color:#eaf2df;border-radius:12px;border:1px solid #c8dac2;">
                            <tr>
                              <td align="center" style="padding:22px 20px;">
                                <span style="font-family:'Outfit',Arial,sans-serif;font-size:42px;font-weight:700;
                                             color:#315c2b;letter-spacing:10px;display:block;">
                                  %s
                                </span>
                              </td>
                            </tr>
                          </table>

                          <p style="margin:0 0 20px;color:#6e6a63;font-size:13px;line-height:1.6;">
                            This code expires in <strong style="color:#315c2b;">%d minutes</strong>.
                          </p>

                          <!-- Warning -->
                          <table cellpadding="0" cellspacing="0" border="0"
                                 style="background-color:#fdf6e3;border-radius:8px;border-left:3px solid #e8a020;">
                            <tr>
                              <td style="padding:12px 14px;">
                                <p style="margin:0;font-size:12px;color:#7a5c10;line-height:1.5;">
                                  <strong>&#9888; Security Notice:</strong> If you did not request this change,
                                  please ignore this email. Your email will not be updated.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Divider -->
                      <tr>
                        <td style="padding:0 36px;">
                          <table cellpadding="0" cellspacing="0" border="0" width="100%%">
                            <tr>
                              <td style="border-top:1px solid #deded5;"></td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="padding:20px 36px 32px;text-align:center;">
                          <p style="margin:0 0 4px;font-size:13px;color:#6e6a63;">
                            Best regards,
                          </p>
                          <p style="margin:0 0 12px;font-family:'Playfair Display',Georgia,serif;font-size:16px;
                                     font-weight:600;color:#315c2b;letter-spacing:-0.02em;">
                            NutriBot Team
                          </p>
                          <p style="margin:0;font-size:11px;color:#9e9a93;line-height:1.5;">
                            If you did not request this, please ignore this email.
                          </p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """.formatted(otp, expirationMinutes);
    }
}
