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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@DisplayName("Kiểm thử VoteService - Chống trùng, Concurrency Guard & Đếm Canonical (BL-001, BL-021, BL-024)")
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
    @DisplayName("Thả tim vào Video/Blog bản nháp hoặc chưa xuất bản -> Bị chặn với NotFoundException (BL-011)")
    void toggleVote_WhenContentDraftOrHidden_ThrowsNotFoundException() {
        User voter = createSampleUser(2, "voter", AccountStatus.ACTIVE);
        when(userRepository.findByUsernameForUpdate("voter")).thenReturn(Optional.of(voter));
        when(contentRepository.findPublishedById(777, "published")).thenReturn(Optional.empty());

        NotFoundException ex = assertThrows(
                NotFoundException.class,
                () -> voteService.toggleVote("voter", 777)
        );

        assertTrue(ex.getMessage().contains("Nội dung không tồn tại"));
        verify(voteRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Thả tim vào nội dung đã xuất bản khi chưa vote -> Thành công tạo Vote với voteValue=1")
    void toggleVote_WhenPublishedAndAuthorActive_Succeeds() {
        User voter = createSampleUser(2, "voter", AccountStatus.ACTIVE);
        User author = createSampleUser(1, "author", AccountStatus.ACTIVE);
        Content video = createSampleContent(201, "VIDEO", "published", author);

        when(userRepository.findByUsernameForUpdate("voter")).thenReturn(Optional.of(voter));
        when(contentRepository.findPublishedById(201, "published")).thenReturn(Optional.of(video));
        when(voteRepository.findByUserIdAndContentIdForUpdate(voter.getUserId(), 201)).thenReturn(Optional.empty());
        when(voteRepository.countByContentId(201)).thenReturn(1L);

        VoteResponse response = voteService.toggleVote("voter", 201);

        assertNotNull(response);
        assertEquals(201, response.getContentId());
        assertTrue(response.getIsVoted());
        assertEquals(1L, response.getVoteCount());
        verify(voteRepository).saveAndFlush(argThat(v -> v.getVoteValue() == 1 && v.getUserId() == 2));
    }

    @Test
    @DisplayName("Bấm thả tim lần 2 (Unvote) -> Xóa vote và trả về isVoted = false, count giảm đúng")
    void toggleVote_WhenAlreadyVoted_RemovesVoteAndFlushes() {
        User voter = createSampleUser(2, "voter", AccountStatus.ACTIVE);
        User author = createSampleUser(1, "author", AccountStatus.ACTIVE);
        Content blog = createSampleContent(101, "BLOG", "published", author);

        Vote existingVote = Vote.builder()
                .voteId(55)
                .userId(voter.getUserId())
                .contentId(101)
                .voteValue((short) 1)
                .build();

        when(userRepository.findByUsernameForUpdate("voter")).thenReturn(Optional.of(voter));
        when(contentRepository.findPublishedById(101, "published")).thenReturn(Optional.of(blog));
        when(voteRepository.findByUserIdAndContentIdForUpdate(voter.getUserId(), 101)).thenReturn(Optional.of(existingVote));
        when(voteRepository.countByContentId(101)).thenReturn(0L);

        VoteResponse response = voteService.toggleVote("voter", 101);

        assertNotNull(response);
        assertFalse(response.getIsVoted());
        assertEquals(0L, response.getVoteCount());
        verify(voteRepository).delete(existingVote);
        verify(voteRepository).flush();
        verify(voteRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Xung đột đồng thời khi 2 request cùng tạo vote -> Bắt DataIntegrityViolationException và ném ConflictException (BL-024)")
    void toggleVote_WhenConcurrentUniqueConflict_ThrowsConflictException() {
        User voter = createSampleUser(2, "voter", AccountStatus.ACTIVE);
        User author = createSampleUser(1, "author", AccountStatus.ACTIVE);
        Content video = createSampleContent(201, "VIDEO", "published", author);

        when(userRepository.findByUsernameForUpdate("voter")).thenReturn(Optional.of(voter));
        when(contentRepository.findPublishedById(201, "published")).thenReturn(Optional.of(video));
        when(voteRepository.findByUserIdAndContentIdForUpdate(voter.getUserId(), 201)).thenReturn(Optional.empty());
        when(voteRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("Duplicate key"));

        ConflictException ex = assertThrows(
                ConflictException.class,
                () -> voteService.toggleVote("voter", 201)
        );

        assertTrue(ex.getMessage().contains("Thao tác vote bị trùng lặp hoặc xung đột"));
    }

    @Test
    @DisplayName("Tài khoản chưa ACTIVE (Bị khóa hoặc chờ xác thực) -> Bị cấm vote với ForbiddenException")
    void toggleVote_WhenUserNotActive_ThrowsForbiddenException() {
        User voter = createSampleUser(2, "banned_user", AccountStatus.BANNED);
        when(userRepository.findByUsernameForUpdate("banned_user")).thenReturn(Optional.of(voter));

        ForbiddenException ex = assertThrows(
                ForbiddenException.class,
                () -> voteService.toggleVote("banned_user", 201)
        );

        assertTrue(ex.getMessage().contains("bị khóa"));
        verify(contentRepository, never()).findPublishedById(any(), any());
    }

    @Test
    @DisplayName("ID nội dung không hợp lệ (<= 0 hoặc null) -> Ném BadRequestException")
    void toggleVote_WhenInvalidContentId_ThrowsBadRequestException() {
        assertThrows(BadRequestException.class, () -> voteService.toggleVote("voter", 0));
        assertThrows(BadRequestException.class, () -> voteService.toggleVote("voter", -5));
        assertThrows(BadRequestException.class, () -> voteService.toggleVote("voter", null));
    }

    @Test
    @DisplayName("Khách vãng lai xem số lượng vote -> Trả về 200, isVoted = false và voteCount chính xác")
    void getVoteStatus_WhenGuestUser_ReturnsIsVotedFalseAndCorrectCount() {
        User author = createSampleUser(1, "author", AccountStatus.ACTIVE);
        Content content = createSampleContent(201, "VIDEO", "published", author);

        when(contentRepository.findPublishedById(201, "published")).thenReturn(Optional.of(content));
        when(voteRepository.countByContentId(201)).thenReturn(42L);

        VoteResponse response = voteService.getVoteStatus(null, 201);

        assertNotNull(response);
        assertEquals(201, response.getContentId());
        assertFalse(response.getIsVoted());
        assertEquals(42L, response.getVoteCount());
        verify(userRepository, never()).findByUsername(any());
    }

    @Test
    @DisplayName("Thành viên đã đăng nhập xem vote -> Trả về isVoted = true nếu đã thả tim")
    void getVoteStatus_WhenAuthenticatedMemberVoted_ReturnsIsVotedTrue() {
        User voter = createSampleUser(2, "voter", AccountStatus.ACTIVE);
        User author = createSampleUser(1, "author", AccountStatus.ACTIVE);
        Content content = createSampleContent(201, "VIDEO", "published", author);

        when(contentRepository.findPublishedById(201, "published")).thenReturn(Optional.of(content));
        when(userRepository.findByUsername("voter")).thenReturn(Optional.of(voter));
        when(voteRepository.existsByUserIdAndContentId(2, 201)).thenReturn(true);
        when(voteRepository.countByContentId(201)).thenReturn(10L);

        VoteResponse response = voteService.getVoteStatus("voter", 201);

        assertNotNull(response);
        assertEquals(201, response.getContentId());
        assertTrue(response.getIsVoted());
        assertEquals(10L, response.getVoteCount());
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
