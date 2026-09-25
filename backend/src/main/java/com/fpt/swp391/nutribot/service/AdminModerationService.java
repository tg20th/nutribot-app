package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.AdminModerationRequest;
import com.fpt.swp391.nutribot.dto.response.AdminContentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminModerationService {

    private final ContentRepository contentRepository;

    @Transactional(readOnly = true)
    public PagedResponse<AdminContentResponse> getPendingContents(String contentType, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Content> pendingPage = contentRepository.findByStatus("pending", pageable);

        Page<Content> filtered = pendingPage;
        if (contentType != null && !contentType.isBlank()) {
            filtered = new org.springframework.data.domain.PageImpl<>(
                    pendingPage.getContent().stream()
                            .filter(c -> c.getContentType().equalsIgnoreCase(contentType))
                            .toList(),
                    pageable,
                    pendingPage.getTotalElements()
            );
        }

        return PagedResponse.of(filtered.map(this::toResponse));
    }

    @Transactional
    public AdminContentResponse moderateContent(Integer contentId, AdminModerationRequest request) {
        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy nội dung với ID: " + contentId));

        String action = request.getAction().toUpperCase();
        switch (action) {
            case "APPROVE" -> content.setStatus("published");
            case "HIDE" -> content.setStatus("hidden");
            case "REJECT" -> content.setStatus("rejected");
            default -> throw new BadRequestException("Action không hợp lệ: " + action);
        }

        Content saved = contentRepository.save(content);
        return toResponse(saved);
    }

    private AdminContentResponse toResponse(Content content) {
        return AdminContentResponse.builder()
                .contentId(content.getContentId())
                .contentType(content.getContentType())
                .title(content.getTitle())
                .slug(content.getSlug())
                .status(content.getStatus())
                .authorUsername(content.getUser() != null ? content.getUser().getUsername() : null)
                .authorEmail(content.getUser() != null ? content.getUser().getEmail() : null)
                .viewCount(content.getViewCount())
                .createdAt(content.getCreatedAt())
                .updatedAt(content.getUpdatedAt())
                .build();
    }
}
