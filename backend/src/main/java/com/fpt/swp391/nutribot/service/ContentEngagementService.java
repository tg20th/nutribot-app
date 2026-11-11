package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.ContentEngagementRequest;
import com.fpt.swp391.nutribot.entity.*;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service @RequiredArgsConstructor
public class ContentEngagementService {
    private final ContentViewEventRepository eventRepository;
    private final ContentRepository contentRepository;
    private final UserRepository userRepository;

    @Transactional
    public ContentViewEvent record(Integer contentId, String username, ContentEngagementRequest request) {
        contentRepository.findPublishedById(contentId, "published")
                .orElseThrow(() -> new NotFoundException("Published content not found"));
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
        LocalDateTime now = LocalDateTime.now();
        var active = eventRepository.findActiveForUpdate(user.getUserId(), contentId);
        ContentViewEvent event = active.isEmpty() ? ContentViewEvent.builder()
                .userId(user.getUserId()).contentId(contentId).startedAt(now).lastActiveAt(now)
                .dwellTimeSec(0).maxScrollPct(BigDecimal.ZERO).completed(false).build() : active.get(0);
        event.setDwellTimeSec(Math.max(event.getDwellTimeSec(), request.getDwellTimeSec()));
        event.setMaxScrollPct(event.getMaxScrollPct() == null ? request.getMaxScrollPct() : event.getMaxScrollPct().max(request.getMaxScrollPct()));
        event.setCompleted(Boolean.TRUE.equals(event.getCompleted()) || request.getCompleted());
        event.setLastActiveAt(now);
        if (Boolean.TRUE.equals(request.getFinalize())) event.setEndedAt(now);
        return eventRepository.save(event);
    }
}
