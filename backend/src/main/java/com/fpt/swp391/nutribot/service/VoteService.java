package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.VoteResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.Vote;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.ConflictException;
import com.fpt.swp391.nutribot.exception.ForbiddenException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.repository.VoteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class VoteService {

    private final VoteRepository voteRepository;
    private final ContentRepository contentRepository;
    private final UserRepository userRepository;

    private static final String PUBLISHED_STATUS = "published";

    @Transactional
    public VoteResponse toggleVote(String username, Integer contentId) {
        validateContentId(contentId);

        User user = userRepository.findByUsernameForUpdate(username)
                .or(() -> userRepository.findByUsername(username))
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        if (user.getStatus() != AccountStatus.ACTIVE) {
            throw new ForbiddenException("Tài khoản chưa được kích hoạt hoặc đã bị khóa");
        }

        contentRepository.findPublishedById(contentId, PUBLISHED_STATUS)
                .orElseThrow(() -> new NotFoundException("Nội dung không tồn tại"));

        Optional<Vote> existingVote = voteRepository.findByUserIdAndContentIdForUpdate(user.getUserId(), contentId)
                .or(() -> voteRepository.findByUserIdAndContentId(user.getUserId(), contentId));

        boolean isVoted;
        if (existingVote.isPresent()) {
            voteRepository.delete(existingVote.get());
            voteRepository.flush();
            isVoted = false;
        } else {
            Vote vote = Vote.builder()
                    .userId(user.getUserId())
                    .contentId(contentId)
                    .voteValue((short) 1)
                    .build();
            try {
                voteRepository.saveAndFlush(vote);
                isVoted = true;
            } catch (DataIntegrityViolationException ex) {
                log.warn("Xung đột đồng thời khi vote contentId={} bởi userId={}: {}",
                        contentId, user.getUserId(), ex.getMessage());
                throw new ConflictException("Thao tác vote bị trùng lặp hoặc xung đột");
            }
        }

        Long voteCount = voteRepository.countByContentId(contentId);

        return VoteResponse.builder()
                .contentId(contentId)
                .voteCount(voteCount)
                .isVoted(isVoted)
                .build();
    }

    @Transactional(readOnly = true)
    public VoteResponse getVoteStatus(String username, Integer contentId) {
        validateContentId(contentId);

        contentRepository.findPublishedById(contentId, PUBLISHED_STATUS)
                .orElseThrow(() -> new NotFoundException("Nội dung không tồn tại"));

        boolean isVoted = false;
        if (username != null) {
            User user = userRepository.findByUsername(username).orElse(null);
            if (user != null && user.getStatus() == AccountStatus.ACTIVE) {
                isVoted = voteRepository.existsByUserIdAndContentId(user.getUserId(), contentId);
            }
        }

        Long voteCount = voteRepository.countByContentId(contentId);

        return VoteResponse.builder()
                .contentId(contentId)
                .voteCount(voteCount)
                .isVoted(isVoted)
                .build();
    }

    private void validateContentId(Integer contentId) {
        if (contentId == null || contentId <= 0) {
            throw new BadRequestException("ID nội dung không hợp lệ");
        }
    }
}
