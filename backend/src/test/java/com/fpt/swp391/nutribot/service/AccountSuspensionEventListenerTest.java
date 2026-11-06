package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.event.AccountSuspendedEvent;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AccountSuspensionEventListenerTest {

    @Test
    void suspensionEvent_isHandledAfterCommitByEmailService() throws Exception {
        AccountSuspensionEmailService emailService = mock(AccountSuspensionEmailService.class);
        AccountSuspensionEventListener listener = new AccountSuspensionEventListener(emailService);
        AccountSuspendedEvent event = new AccountSuspendedEvent(10, true, "Repeated content violations");

        listener.onAccountSuspended(event);

        verify(emailService).sendSuspensionNotice(event);
        Method method = AccountSuspensionEventListener.class.getMethod("onAccountSuspended", AccountSuspendedEvent.class);
        TransactionalEventListener annotation = method.getAnnotation(TransactionalEventListener.class);
        assertThat(annotation).isNotNull();
        assertThat(annotation.phase()).isEqualTo(TransactionPhase.AFTER_COMMIT);
    }
}
