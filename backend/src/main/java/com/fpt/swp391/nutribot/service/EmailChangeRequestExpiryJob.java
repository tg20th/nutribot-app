package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.repository.EmailChangeRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class EmailChangeRequestExpiryJob {

    private final EmailChangeRequestRepository emailChangeRequestRepository;

    @Scheduled(fixedDelayString = "${app.email-change.cleanup-interval-ms:60000}")
    @Transactional
    public void deleteExpiredRequests() {
        emailChangeRequestRepository.deleteByExpiresAtLessThanEqual(LocalDateTime.now());
    }
}
