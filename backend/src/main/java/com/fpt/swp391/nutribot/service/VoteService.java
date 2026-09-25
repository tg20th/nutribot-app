package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.VoteResponse;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.Vote;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.repository.VoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VoteService {

    private final VoteRepository voteRepository;
    private final ContentRepository contentRepository;
    private final UserRepository userRepository;

    @Transactional
    public VoteResponse toggleVote(String username, Integer contentId) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("Người dùng không tồn tại"));

        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new BadRequestException("Nội dung không tồn tại"));

        boolean isVoted;
        if (voteRepository.existsByUserIdAndContentId(user.getUserId(), contentId)) {
            voteRepository.deleteByUserIdAndContentId(user.getUserId(), contentId);
            isVoted = false;
        } else {
            Vote vote = Vote.builder()
                    .userId(user.getUserId())
                    .contentId(contentId)
                    .voteType("like")
                    .build();
            voteRepository.save(vote);
            isVoted = true;
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
        boolean isVoted = false;
        if (username != null) {
            User user = userRepository.findByUsername(username).orElse(null);
            if (user != null) {
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
}
