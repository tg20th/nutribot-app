package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.AdminCommentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.Comment;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.CommentRepository;
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
public class AdminCommentService {

    private final CommentRepository commentRepository;
    private final ContentRepository contentRepository;

    @Transactional(readOnly = true)
    public PagedResponse<AdminCommentResponse> getAllComments(String keyword, String status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Comment> commentPage = commentRepository.findAll(pageable);

        return PagedResponse.of(commentPage.map(this::toResponse));
    }

    @Transactional
    public void deleteComment(Integer commentId) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy bình luận với ID: " + commentId));
        commentRepository.delete(comment);
    }

    private AdminCommentResponse toResponse(Comment comment) {
        String contentTitle = null;
        String contentType = null;
        String username = null;
        String userEmail = null;

        if (comment.getUser() != null) {
            username = comment.getUser().getUsername();
            userEmail = comment.getUser().getEmail();
        }

        Content content = contentRepository.findById(comment.getContentId()).orElse(null);
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
