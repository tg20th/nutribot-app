package com.fpt.swp391.nutribot.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class UserNotificationSenderImpl implements UserNotificationSender {

    private final EmailService emailService;

    @Override
    public void sendWarningNotification(String recipient, String username, int strikeCount, String reason) {
        String subject = "Important: Action Taken on Your NutriBot Account";
        String htmlBody = buildWarningHtml(username, strikeCount, reason);
        emailService.sendHtmlEmail(recipient, subject, htmlBody);
    }

    @Override
    public void sendBannedNotification(String recipient, String username, String reason) {
        String subject = "Your NutriBot Account Has Been Suspended";
        String htmlBody = buildBannedHtml(username, reason);
        emailService.sendHtmlEmail(recipient, subject, htmlBody);
    }

    private String buildWarningHtml(String username, int strikeCount, String reason) {
        String strikeText = strikeCount == 1 ? "1 strike" : strikeCount + " strikes";
        String warningIcon = strikeCount >= 2 ? "&#9888;" : "&#9888;";

        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>NutriBot Account Warning</title>
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
                            Hi %s,
                          </h1>
                          <p style="margin:0 0 20px;color:#6e6a63;font-size:15px;line-height:1.6;">
                            We have reviewed your account and found content or behavior that does not comply
                            with NutriBot community guidelines. As a result, a warning has been issued.
                          </p>

                          <!-- Strike Count -->
                          <table cellpadding="0" cellspacing="0" border="0" width="100%%"
                                 style="margin:0 0 24px;background-color:#fff3cd;border-radius:12px;border:1px solid #e8a020;">
                            <tr>
                              <td align="center" style="padding:18px 20px;">
                                <span style="font-family:'Outfit',Arial,sans-serif;font-size:28px;font-weight:700;
                                             color:#7a5c10;display:block;">
                                  %s
                                </span>
                                <span style="font-size:12px;color:#9a7c20;margin-top:4px;display:block;">
                                  issued to your account
                                </span>
                              </td>
                            </tr>
                          </table>

                          %s

                          <p style="margin:20px 0 0;color:#6e6a63;font-size:13px;line-height:1.6;">
                            <strong>What happens next?</strong><br>
                            Your account remains active, but further violations may result in
                            permanent account suspension.
                          </p>
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
                            If you believe this is a mistake, please contact our support team.
                          </p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """.formatted(username, strikeText, buildReasonBlock(reason));
    }

    private String buildReasonBlock(String reason) {
        if (reason == null || reason.isBlank()) {
            return "";
        }
        return """
            <table cellpadding="0" cellspacing="0" border="0"
                   style="background-color:#fdf6e3;border-radius:8px;border-left:3px solid #e8a020;">
              <tr>
                <td style="padding:12px 14px;">
                  <p style="margin:0;font-size:12px;color:#7a5c10;line-height:1.5;">
                    <strong>&#9888; Reason:</strong> %s
                  </p>
                </td>
              </tr>
            </table>
            """.formatted(reason);
    }

    private String buildBannedHtml(String username, String reason) {
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>NutriBot Account Suspended</title>
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
                        <td style="background-color:#8b1a1a;padding:28px 36px;text-align:center;">
                          <p style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:32px;font-weight:600;
                                     color:#fffefa;letter-spacing:-0.5px;">
                            NutriBot
                          </p>
                          <p style="margin:6px 0 0;font-size:10px;letter-spacing:0.18em;color:#ffcccc;
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
                            Hi %s,
                          </h1>
                          <p style="margin:0 0 20px;color:#6e6a63;font-size:15px;line-height:1.6;">
                            After careful review, your NutriBot account has been permanently suspended
                            due to repeated or severe violations of our community guidelines.
                          </p>

                          %s

                          <p style="margin:20px 0 0;color:#6e6a63;font-size:13px;line-height:1.6;">
                            You will no longer be able to log in or access your account. If you
                            believe this decision was made in error, you may submit an appeal
                            by contacting our support team.
                          </p>
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
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """.formatted(username, buildBannedReasonBlock(reason));
    }

    private String buildBannedReasonBlock(String reason) {
        if (reason == null || reason.isBlank()) {
            return "";
        }
        return """
            <table cellpadding="0" cellspacing="0" border="0"
                   style="background-color:#fdf0f0;border-radius:8px;border-left:3px solid #c0392b;">
              <tr>
                <td style="padding:12px 14px;">
                  <p style="margin:0;font-size:12px;color:#7a1a1a;line-height:1.5;">
                    <strong>&#9888; Reason:</strong> %s
                  </p>
                </td>
              </tr>
            </table>
            """.formatted(reason);
    }
}
