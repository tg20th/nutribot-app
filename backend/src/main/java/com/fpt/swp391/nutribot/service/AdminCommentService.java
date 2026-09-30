package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.AdminCommentStatusRequest;
import com.fpt.swp391.nutribot.dto.response.AdminCommentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.Comment;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.CommentRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.specification.CommentSpecifications;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminCommentService {

    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final int MAX_PAGE_SIZE = 50;
    private static final Set<String> CANONICAL_STATUSES = Set.of("published", "hidden", "rejected");

    private final CommentRepository commentRepository;
    private final ContentRepository contentRepository;

    @Transactional(readOnly = true)
    public PagedResponse<AdminCommentResponse> getAllComments(String keyword, String status, int page, int size) {
        int boundedPage = Math.max(page, 0);
        int boundedSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);

        Pageable pageable = PageRequest.of(boundedPage, boundedSize, Sort.by(Sort.Direction.DESC, "createdAt", "commentId"));
        Specification<Comment> spec = CommentSpecifications.withFilter(keyword, status);
        Page<Comment> commentPage = commentRepository.findAll(spec, pageable);

        Set<Integer> contentIds = commentPage.getContent().stream()
                .map(Comment::getContentId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<Integer, Content> contentMap = contentIds.isEmpty() ? Collections.emptyMap() :
                contentRepository.findAllById(contentIds).stream()
                        .collect(Collectors.toMap(Content::getContentId, c -> c, (existing, replacing) -> existing));

        List<AdminCommentResponse> responses = commentPage.getContent().stream()
                .map(comment -> toResponse(comment, contentMap.get(comment.getContentId())))
                .toList();

        return PagedResponse.<AdminCommentResponse>builder()
                .content(responses)
                .page(commentPage.getNumber())
                .size(commentPage.getSize())
                .totalElements(commentPage.getTotalElements())
                .totalPages(commentPage.getTotalPages())
                .first(commentPage.isFirst())
                .last(commentPage.isLast())
                .build();
    }

    @Transactional
    public void deleteComment(Integer commentId) {
        deleteComment(commentId, "ADMIN");
    }

    @Transactional
    public void deleteComment(Integer commentId, String adminUsername) {
        Comment comment = commentRepository.findByIdForUpdate(commentId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy bình luận với ID: " + commentId));

        comment.setStatus("hidden");
        comment.setUpdatedAt(LocalDateTime.now());
        commentRepository.save(comment);

        log.info("AUDIT: Admin [{}] đã ẩn (soft-delete) bình luận [ID: {}]", adminUsername, commentId);
    }

    @Transactional
    public AdminCommentResponse updateCommentStatus(Integer commentId, AdminCommentStatusRequest request, String adminUsername) {
        if (request == null || request.getStatus() == null || request.getStatus().isBlank()) {
            throw new BadRequestException("Trạng thái kiểm duyệt không được để trống");
        }

        String normalizedStatus = request.getStatus().trim().toLowerCase();
        if (!CANONICAL_STATUSES.contains(normalizedStatus)) {
            throw new BadRequestException("Trạng thái không hợp lệ: " + request.getStatus());
        }

        Comment comment = commentRepository.findByIdForUpdate(commentId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy bình luận với ID: " + commentId));

        String oldStatus = comment.getStatus();
        comment.setStatus(normalizedStatus);
        comment.setUpdatedAt(LocalDateTime.now());
        Comment saved = commentRepository.save(comment);

        log.info("AUDIT: Admin [{}] đã thay đổi trạng thái bình luận [ID: {}] từ [{}] sang [{}]. Lý do: {}",
                adminUsername, commentId, oldStatus, normalizedStatus, request.getReason());

        Content content = contentRepository.findById(saved.getContentId()).orElse(null);
        return toResponse(saved, content);
    }

    private AdminCommentResponse toResponse(Comment comment, Content content) {
        String contentTitle = null;
        String contentType = null;
        String username = null;
        String userEmail = null;

        if (comment.getUser() != null) {
            username = comment.getUser().getUsername();
            userEmail = comment.getUser().getEmail();
        }

        if (content != null) {
            contentTitle = content.getTitle();
            contentType = content.getContentType();
        }

        return AdminCommentResponse.builder()
                .commentId(comment.getCommentId())
                .contentId(comment.getContentId())
                .contentTitle(contentTitle)
                .contentType(contentType)
                .userId(comment.getUserId())
                .username(username)
                .userEmail(userEmail)
                .parentId(comment.getParentId())
                .body(comment.getBody())
                .status(comment.getStatus())
                .createdAt(comment.getCreatedAt())
                .build();
    }
}
