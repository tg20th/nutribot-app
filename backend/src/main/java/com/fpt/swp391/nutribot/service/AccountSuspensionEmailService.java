package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.repository.ModerationDecisionAuditRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.format.DateTimeFormatter;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
@RequiredArgsConstructor
public class AccountSuspensionEmailService {
    private static final Logger log = LoggerFactory.getLogger(AccountSuspensionEmailService.class);
    private final UserRepository userRepository;
    private final ModerationDecisionAuditRepository auditRepository;
    private final EmailService emailService;
    @Value("${nutribot.support.email:}") private String supportEmail;

    @Transactional(readOnly = true)
    public void sendSuspensionNotice(com.fpt.swp391.nutribot.event.AccountSuspendedEvent event) {
        log.info("AccountSuspensionEmailService invoked: userId={}, type={}", event == null ? null : event.userId(), event != null && event.strikeBased() ? "STRIKE" : "MANUAL");
        if (event == null || event.userId() == null) {
            log.warn("Suspension email skipped: event or userId is missing");
            return;
        }
        Integer userId = event.userId();
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            log.warn("Suspension email skipped: user not found, userId={}", userId);
            return;
        }
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            log.warn("Suspension email skipped: recipient email is missing, userId={}", userId);
            return;
        }
        log.info("Suspension email delivery attempt: userId={}", userId);
        String history = auditRepository.findByAuthorIdAndActionOrderByDecidedAtDescAuditIdDesc(userId, "REJECT", org.springframework.data.domain.PageRequest.of(0, 50))
                .getContent().stream().map(a -> "- " + (a.getContentTitle() == null ? "Unavailable content" : a.getContentTitle())
                        + " — " + (a.getAdminReason() == null ? "Reason unavailable" : a.getAdminReason())
                        + " (" + (a.getDecidedAt() == null ? "Date unavailable" : a.getDecidedAt().format(DateTimeFormatter.ISO_LOCAL_DATE)) + ")")
                .collect(Collectors.joining("\n"));
        String body = "Hello " + (user.getFullName() == null ? user.getUsername() : user.getFullName()) + ",\n\n"
                + (event.strikeBased() ? "Your NutriBot account has been suspended after reaching 3/3 content violations.\n\nViolation history:\n" + history : "Your NutriBot account has been suspended by an administrator.\n\nReason for suspension:\n" + (event.reason() == null || event.reason().isBlank() ? "No reason was provided." : event.reason().trim())) + "\n\n"
                + "If you believe this decision was made in error, reply to this email to request a manual account review."
                + (supportEmail == null || supportEmail.isBlank() ? "" : "\nSupport: " + supportEmail) + "\n\nNutriBot Team";
        try {
            emailService.sendEmailWithReplyTo(user.getEmail(), "Your NutriBot account has been suspended", body, supportEmail);
            log.info("Suspension email delivery succeeded: userId={}", userId);
        } catch (Exception ex) {
            log.error("Could not send suspension email for user {}", userId, ex);
        }
    }
}
