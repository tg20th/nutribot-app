package com.fpt.swp391.nutribot.service;

import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.Properties;

@Service
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final boolean emailEnabled;

    public EmailService(
            @Value("${spring.mail.host:localhost}") String host,
            @Value("${spring.mail.port:1025}") int port,
            @Value("${spring.mail.username:}") String username,
            @Value("${spring.mail.password:}") String password,
            @Value("${spring.mail.enabled:false}") boolean enabled
    ) {
        this.emailEnabled = enabled;
        log.info("SMTP configuration: enabled={}, host={}, port={}, usernamePresent={}, passwordPresent={}", enabled, host, port, username != null && !username.isBlank(), password != null && !password.isBlank());
        if (enabled && (username == null || username.isBlank() || password == null || password.isBlank())) {
            log.error("SMTP is enabled but MAIL_USERNAME or MAIL_PASSWORD is missing");
        }
        if (enabled) {
            JavaMailSenderImpl sender = new JavaMailSenderImpl();
            sender.setHost(host);
            sender.setPort(port);
            sender.setUsername(username);
            sender.setPassword(password);
            Properties props = sender.getJavaMailProperties();
            props.put("mail.transport.protocol", "smtp");
            props.put("mail.smtp.auth", "true");
            props.put("mail.smtp.starttls.enable", "true");
            this.mailSender = sender;
        } else {
            this.mailSender = null;
        }
    }

    public void sendEmail(String to, String subject, String body) {
        if (emailEnabled && mailSender != null) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(to);
                message.setSubject(subject);
                message.setText(body);
                mailSender.send(message);
                log.info("Email sent to {}", to);
            } catch (Exception e) {
                log.error("Failed to send email to {}: {}", to, e.getMessage());
            }
        } else {
            // Dev mode: log to console
            log.info("=== DEV EMAIL ===");
            log.info("To: {}", to);
            log.info("Subject: {}", subject);
            log.info("Body: {}", body);
            log.info("================");
        }
    }

    /** Sends an HTML email with inline CSS styling. */
    public void sendHtmlEmail(String to, String subject, String htmlBody) {
        if (emailEnabled && mailSender != null) {
            try {
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
                helper.setTo(to);
                helper.setSubject(subject);
                helper.setText(htmlBody, true);
                mailSender.send(message);
                log.info("HTML email sent to {}", to);
            } catch (Exception e) {
                log.error("Failed to send HTML email to {}: {}", to, e.getMessage());
            }
        } else {
            // Dev mode: log to console
            log.info("=== DEV HTML EMAIL ===");
            log.info("To: {}", to);
            log.info("Subject: {}", subject);
            log.info("Body: {}", htmlBody);
            log.info("======================");
        }
    }

    /** Sends security-sensitive mail only when SMTP is configured and reports delivery failures. */
    public void sendEmailOrThrow(String to, String subject, String body) {
        if (!emailEnabled || mailSender == null) {
            throw new IllegalStateException("Email delivery is disabled.");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
        log.info("Email sent to {}", to);
    }

    public void sendEmailWithReplyTo(String to, String subject, String body, String replyTo) {
        if (!emailEnabled || mailSender == null) {
            log.warn("Suspension email not attempted: SMTP is disabled or JavaMailSender is unavailable");
            return;
        }
        log.info("Suspension email SMTP attempt started: recipientPresent={}, replyToPresent={}", to != null && !to.isBlank(), replyTo != null && !replyTo.isBlank());
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            if (replyTo != null && !replyTo.isBlank()) message.setReplyTo(replyTo);
            mailSender.send(message);
            log.info("Suspension email SMTP transport accepted the message");
        } catch (Exception ex) {
            log.error("Suspension email SMTP delivery failed: {}", ex.getMessage(), ex);
            throw new IllegalStateException("Suspension email delivery failed", ex);
        }
    }
}
