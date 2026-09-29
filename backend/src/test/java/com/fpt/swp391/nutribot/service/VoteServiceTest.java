package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.VoteResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.repository.VoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@DisplayName("Kiểm thử VoteService - Visibility Guard & Chặn thả tim trên nội dung chưa công khai (BL-011)")
class VoteServiceTest {

    private VoteRepository voteRepository;
    private ContentRepository contentRepository;
    private UserRepository userRepository;
    private VoteService voteService;

    @BeforeEach
    void setUp() {
        voteRepository = mock(VoteRepository.class);
        contentRepository = mock(ContentRepository.class);
        userRepository = mock(UserRepository.class);
        voteService = new VoteService(voteRepository, contentRepository, userRepository);
    }

    private User createSampleUser(int id, String username, AccountStatus status) {
        return User.builder()
                .userId(id)
                .username(username)
                .fullName("User " + username)
                .status(status)
                .build();
    }

    private Content createSampleContent(int id, String contentType, String status, User author) {
        return Content.builder()
                .contentId(id)
                .contentType(contentType)
                .status(status)
                .title("Sample " + contentType)
                .slug("sample-" + contentType.toLowerCase() + "-" + id)
                .user(author)
                .viewCount(0)
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("Thả tim vào Video/Blog bản nháp hoặc chưa xuất bản -> Bị chặn với NotFoundException")
    void toggleVote_WhenContentDraftOrHidden_ThrowsNotFoundException() {
        User voter = createSampleUser(2, "voter", AccountStatus.ACTIVE);
        when(userRepository.findByUsername("voter")).thenReturn(Optional.of(voter));
        when(contentRepository.findPublishedById(777, "published")).thenReturn(Optional.empty());

        NotFoundException ex = assertThrows(
                NotFoundException.class,
                () -> voteService.toggleVote("voter", 777)
        );

        assertTrue(ex.getMessage().contains("Nội dung không tồn tại"));
        verify(voteRepository, never()).save(any());
    }

    @Test
    @DisplayName("Thả tim vào nội dung đã xuất bản của tác giả ACTIVE -> Thành công toggle vote")
    void toggleVote_WhenPublishedAndAuthorActive_Succeeds() {
        User voter = createSampleUser(2, "voter", AccountStatus.ACTIVE);
        User author = createSampleUser(1, "author", AccountStatus.ACTIVE);
        Content video = createSampleContent(201, "VIDEO", "published", author);

        when(userRepository.findByUsername("voter")).thenReturn(Optional.of(voter));
        when(contentRepository.findPublishedById(201, "published")).thenReturn(Optional.of(video));
        when(voteRepository.existsByUserIdAndContentId(voter.getUserId(), 201)).thenReturn(false);
        when(voteRepository.countByContentId(201)).thenReturn(1L);

        VoteResponse response = voteService.toggleVote("voter", 201);

        assertNotNull(response);
        assertEquals(201, response.getContentId());
        assertTrue(response.getIsVoted());
        assertEquals(1L, response.getVoteCount());
        verify(voteRepository).save(any());
    }

    @Test
    @DisplayName("Lấy trạng thái vote trên nội dung bản nháp -> Ném NotFoundException")
    void getVoteStatus_WhenDraftOrHidden_ThrowsNotFoundException() {
        when(contentRepository.findPublishedById(999, "published")).thenReturn(Optional.empty());

        NotFoundException ex = assertThrows(
                NotFoundException.class,
                () -> voteService.getVoteStatus("user1", 999)
        );

        assertTrue(ex.getMessage().contains("Nội dung không tồn tại"));
    }
}
