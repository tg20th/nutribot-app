package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.CommentCreateRequest;
import com.fpt.swp391.nutribot.dto.response.CommentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.Comment;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.ForbiddenException;
import com.fpt.swp391.nutribot.repository.CommentRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepository;
    private final ContentRepository contentRepository;
    private final UserRepository userRepository;

    private static final String ACTIVE_STATUS = "active";

    @Transactional(readOnly = true)
    public PagedResponse<CommentResponse> getCommentsByContentId(Integer contentId, int page, int size) {
        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new BadRequestException("Nội dung không tồn tại"));

        Pageable pageable = PageRequest.of(page, size);
        Page<Comment> commentsPage = commentRepository.findByContentIdAndParentIdIsNullAndStatus(contentId, ACTIVE_STATUS, pageable);

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
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new BadRequestException("Nội dung không tồn tại"));

        if (request.getParentId() != null) {
            Comment parent = commentRepository.findById(request.getParentId())
                    .orElseThrow(() -> new BadRequestException("Bình luận cha không tồn tại"));
            if (!parent.getContentId().equals(contentId)) {
                throw new BadRequestException("Bình luận cha không thuộc nội dung này");
            }
        }

        Comment comment = Comment.builder()
                .contentId(contentId)
                .userId(user.getUserId())
                .parentId(request.getParentId())
                .body(request.getBody())
                .status(ACTIVE_STATUS)
                .build();

        Comment saved = commentRepository.save(comment);
        return toCommentResponse(saved);
    }

    @Transactional
    public void deleteComment(String username, Integer commentId) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new BadRequestException("Bình luận không tồn tại"));

        if (!comment.getUserId().equals(user.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền xóa bình luận này");
        }

        comment.setStatus("deleted");
        commentRepository.save(comment);
    }

    private CommentResponse toCommentResponse(Comment comment) {
        User user = userRepository.findById(comment.getUserId()).orElse(null);
        String userName = user != null ? user.getFullName() : "Unknown";

        return CommentResponse.builder()
                .commentId(comment.getCommentId())
                .contentId(comment.getContentId())
                .userId(comment.getUserId())
                .userName(userName)
                .parentId(comment.getParentId())
                .body(comment.getBody())
                .createdAt(comment.getCreatedAt())
                .build();
    }

    private CommentResponse toCommentResponseWithReplies(Comment comment) {
        CommentResponse response = toCommentResponse(comment);

        List<Comment> replies = commentRepository.findByParentId(comment.getCommentId());
        if (!replies.isEmpty()) {
            response.setReplies(replies.stream()
                    .map(this::toCommentResponse)
                    .collect(Collectors.toList()));
        }

        return response;
    }
}
