package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.CommentCreateRequest;
import com.fpt.swp391.nutribot.dto.request.CommentUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.CommentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Comment;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.ForbiddenException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.CommentRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepository;
    private final ContentRepository contentRepository;
    private final UserRepository userRepository;

    public static final String STATUS_PUBLISHED = "published";
    public static final String STATUS_HIDDEN = "hidden";
    public static final String STATUS_REJECTED = "rejected";

    @Transactional(readOnly = true)
    public PagedResponse<CommentResponse> getCommentsByContentId(Integer contentId, int page, int size) {
        validateContentId(contentId);

        contentRepository.findPublishedById(contentId, STATUS_PUBLISHED)
                .orElseThrow(() -> new NotFoundException("Nội dung không tồn tại"));

        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(50, size));
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt", "commentId"));

        Page<Comment> commentsPage = commentRepository.findByContentIdAndParentIdIsNullAndStatus(
                contentId, STATUS_PUBLISHED, pageable);

        List<CommentResponse> responses = commentsPage.getContent().stream()
                .map(this::toCommentResponseWithReplies)
                .collect(Collectors.toList());

        return PagedResponse.<CommentResponse>builder()
                .content(responses)
                .page(commentsPage.getNumber())
                .size(commentsPage.getSize())
                .totalElements(commentsPage.getTotalElements())
                .totalPages(commentsPage.getTotalPages())
                .first(commentsPage.isFirst())
                .last(commentsPage.isLast())
                .build();
    }

    @Transactional
    public CommentResponse createComment(String username, Integer contentId, CommentCreateRequest request) {
        validateContentId(contentId);

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        if (user.getStatus() != AccountStatus.ACTIVE) {
            throw new ForbiddenException("Tài khoản chưa được kích hoạt hoặc đã bị khóa");
        }

        contentRepository.findPublishedById(contentId, STATUS_PUBLISHED)
                .orElseThrow(() -> new NotFoundException("Nội dung không tồn tại hoặc chưa được công khai"));

        String cleanBody = sanitizeAndValidateBody(request.getBody());

        if (request.getParentId() != null) {
            Comment parent = commentRepository.findById(request.getParentId())
                    .orElseThrow(() -> new BadRequestException("Bình luận cha không tồn tại"));
            if (!parent.getContentId().equals(contentId)) {
                throw new BadRequestException("Bình luận cha không thuộc nội dung này");
            }
            if (!STATUS_PUBLISHED.equalsIgnoreCase(parent.getStatus())) {
                throw new BadRequestException("Không thể trả lời bình luận đã bị ẩn hoặc xóa");
            }
        }

        Comment comment = Comment.builder()
                .contentId(contentId)
                .userId(user.getUserId())
                .parentId(request.getParentId())
                .body(cleanBody)
                .status(STATUS_PUBLISHED)
                .build();

        Comment saved = commentRepository.save(comment);
        return toCommentResponse(saved);
    }

    @Transactional
    public CommentResponse updateComment(String username, Integer commentId, CommentUpdateRequest request) {
        if (commentId == null || commentId <= 0) {
            throw new BadRequestException("ID bình luận không hợp lệ");
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        if (user.getStatus() != AccountStatus.ACTIVE) {
            throw new ForbiddenException("Tài khoản chưa được kích hoạt hoặc đã bị khóa");
        }

        Comment comment = commentRepository.findByIdForUpdate(commentId)
                .or(() -> commentRepository.findById(commentId))
                .orElseThrow(() -> new NotFoundException("Bình luận không tồn tại"));

        if (!comment.getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa bình luận này");
        }

        if (!STATUS_PUBLISHED.equalsIgnoreCase(comment.getStatus())) {
            throw new BadRequestException("Không thể chỉnh sửa bình luận đã bị ẩn hoặc từ chối");
        }

        contentRepository.findPublishedById(comment.getContentId(), STATUS_PUBLISHED)
                .orElseThrow(() -> new NotFoundException("Nội dung không tồn tại hoặc đã bị ẩn"));

        String cleanBody = sanitizeAndValidateBody(request.getBody());

        comment.setBody(cleanBody);
        comment.setUpdatedAt(LocalDateTime.now());
        Comment updated = commentRepository.save(comment);

        return toCommentResponse(updated);
    }

    @Transactional
    public void deleteComment(String username, Integer commentId) {
        if (commentId == null || commentId <= 0) {
            throw new BadRequestException("ID bình luận không hợp lệ");
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Comment comment = commentRepository.findByIdForUpdate(commentId)
                .or(() -> commentRepository.findById(commentId))
                .orElseThrow(() -> new NotFoundException("Bình luận không tồn tại"));

        if (!comment.getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền xóa bình luận này");
        }

        comment.setStatus(STATUS_HIDDEN);
        comment.setUpdatedAt(LocalDateTime.now());
        commentRepository.save(comment);
    }

    private void validateContentId(Integer contentId) {
        if (contentId == null || contentId <= 0) {
            throw new BadRequestException("ID nội dung không hợp lệ");
        }
    }

    private String sanitizeAndValidateBody(String rawBody) {
        if (rawBody == null || rawBody.trim().isEmpty()) {
            throw new BadRequestException("Nội dung bình luận không được để trống");
        }
        String cleanBody = rawBody.trim();
        if (cleanBody.length() > 2000) {
            throw new BadRequestException("Bình luận không được vượt quá 2000 ký tự");
        }
        return cleanBody;
    }

    private CommentResponse toCommentResponse(Comment comment) {
        User user = userRepository.findById(comment.getUserId()).orElse(null);
        String userName = user != null ? user.getFullName() : "Unknown";
        String userAvatar = user != null ? user.getAvatarUrl() : null;

        return CommentResponse.builder()
                .commentId(comment.getCommentId())
                .contentId(comment.getContentId())
                .userId(comment.getUserId())
                .userName(userName)
                .userAvatar(userAvatar)
                .avatarUrl(userAvatar)
                .parentId(comment.getParentId())
                .body(comment.getBody())
                .createdAt(comment.getCreatedAt())
                .build();
    }

    private CommentResponse toCommentResponseWithReplies(Comment comment) {
        CommentResponse response = toCommentResponse(comment);

        List<Comment> replies = commentRepository.findByParentIdAndStatus(comment.getCommentId(), STATUS_PUBLISHED);
        if (!replies.isEmpty()) {
            response.setReplies(replies.stream()
                    .map(this::toCommentResponse)
                    .collect(Collectors.toList()));
        }

        return response;
    }
}
