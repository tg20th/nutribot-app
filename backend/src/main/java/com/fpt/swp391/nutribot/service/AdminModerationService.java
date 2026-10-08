package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.AdminModerationRequest;
import com.fpt.swp391.nutribot.dto.response.AdminContentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.ContentModeration;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.ContentModerationRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminModerationService {

    private final ContentRepository contentRepository;
    private final ContentModerationRepository contentModerationRepository;

    @Transactional(readOnly = true)
    public PagedResponse<AdminContentResponse> getPendingContents(String contentType, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        List<String> pendingStatuses = List.of("under_review", "pending");

        Page<Content> pendingPage;
        if (contentType != null && !contentType.isBlank()) {
            pendingPage = contentRepository.findByStatusInAndContentType(pendingStatuses, contentType, pageable);
        } else {
            pendingPage = contentRepository.findByStatusIn(pendingStatuses, pageable);
        }

        List<Integer> contentIds = pendingPage.getContent().stream()
                .map(Content::getContentId)
                .toList();

        Map<Integer, ContentModeration> moderationMap = contentModerationRepository.findByContentIdIn(contentIds)
                .stream()
                .collect(Collectors.toMap(
                        ContentModeration::getContentId,
                        Function.identity(),
                        (existing, replacement) -> existing
                ));

        return PagedResponse.of(pendingPage.map(c -> toResponse(c, moderationMap.get(c.getContentId()))));
    }

    @Transactional
    public AdminContentResponse moderateContent(Integer contentId, AdminModerationRequest request) {
        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy nội dung với ID: " + contentId));

        String action = request.getAction().toUpperCase();
        switch (action) {
            case "APPROVE" -> content.setStatus("published");
            case "HIDE" -> content.setStatus("archived");
            case "REJECT" -> content.setStatus("rejected");
            default -> throw new BadRequestException("Action không hợp lệ: " + action);
        }

        Content saved = contentRepository.save(content);

        contentModerationRepository.findByContentId(contentId).ifPresent(cm -> {
            switch (action) {
                case "APPROVE" -> cm.setStatus("approved");
                case "HIDE", "REJECT" -> cm.setStatus("rejected");
            }
            cm.setReviewedAt(LocalDateTime.now());
            contentModerationRepository.save(cm);
        });

        ContentModeration cm = contentModerationRepository.findByContentId(contentId).orElse(null);
        return toResponse(saved, cm);
    }

    private AdminContentResponse toResponse(Content content) {
        ContentModeration cm = contentModerationRepository.findByContentId(content.getContentId()).orElse(null);
        return toResponse(content, cm);
    }

    private AdminContentResponse toResponse(Content content, ContentModeration moderation) {
        return AdminContentResponse.builder()
                .contentId(content.getContentId())
                .contentType(content.getContentType())
                .title(content.getTitle())
                .slug(content.getSlug())
                .status(content.getStatus())
                .body(content.getBody())
                .thumbnailUrl(content.getThumbnailUrl())
                .mediaUrl(content.getMediaUrl())
                .authorUsername(content.getUser() != null ? content.getUser().getUsername() : null)
                .authorEmail(content.getUser() != null ? content.getUser().getEmail() : null)
                .viewCount(content.getViewCount())
                .createdAt(content.getCreatedAt())
                .updatedAt(content.getUpdatedAt())
                .aiFlagged(moderation != null ? moderation.getAiFlagged() : null)
                .aiReason(moderation != null ? moderation.getAiReason() : null)
                .aiConfidence(moderation != null && moderation.getAiConfidence() != null ? moderation.getAiConfidence().doubleValue() : null)
                .build();
    }
}
