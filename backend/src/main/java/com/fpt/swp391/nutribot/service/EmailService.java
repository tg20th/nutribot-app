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
}
