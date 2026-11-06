package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.event.AccountSuspendedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class AccountSuspensionEventListener {
    private final AccountSuspensionEmailService emailService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onAccountSuspended(AccountSuspendedEvent event) {
        if (event != null && event.userId() != null) {
            log.info("Account suspension event received: userId={}, type={}", event.userId(), event.strikeBased() ? "STRIKE" : "MANUAL");
            emailService.sendSuspensionNotice(event);
        }
    }
}
