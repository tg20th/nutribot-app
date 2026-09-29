package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.VoteToggleRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.VoteResponse;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.service.VoteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DisplayName("Kiểm thử VoteController (Task NB-28: Vote API & Chống trùng lặp)")
class VoteControllerTest {

    private VoteService voteService;
    private VoteController voteController;
    private UserDetails authenticatedUser;

    @BeforeEach
    void setUp() {
        voteService = mock(VoteService.class);
        voteController = new VoteController(voteService);
        authenticatedUser = new User("truong", "password", Collections.emptyList());
    }

    @Test
    @DisplayName("POST /api/v1/contents/{contentId}/vote -> Toggle vote thành công cho user đăng nhập")
    void toggleVote_WithAuthenticatedUser_ReturnsOk() {
        VoteResponse voteResponse = VoteResponse.builder()
                .contentId(101)
                .voteCount(5L)
                .isVoted(true)
                .build();

        when(voteService.toggleVote("truong", 101)).thenReturn(voteResponse);

        ResponseEntity<ApiResponse<VoteResponse>> response = voteController.toggleVote(authenticatedUser, 101);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().isSuccess());
        assertEquals(5L, response.getBody().getData().getVoteCount());
        assertTrue(response.getBody().getData().getIsVoted());
        verify(voteService).toggleVote("truong", 101);
    }

    @Test
    @DisplayName("GET /api/v1/contents/{contentId}/vote -> Khách vãng lai (user = null) lấy trạng thái vote thành công")
    void getVoteStatus_WithGuestUser_ReturnsOk() {
        VoteResponse voteResponse = VoteResponse.builder()
                .contentId(101)
                .voteCount(12L)
                .isVoted(false)
                .build();

        when(voteService.getVoteStatus(null, 101)).thenReturn(voteResponse);

        ResponseEntity<ApiResponse<VoteResponse>> response = voteController.getVoteStatus(null, 101);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().isSuccess());
        assertFalse(response.getBody().getData().getIsVoted());
        assertEquals(12L, response.getBody().getData().getVoteCount());
        verify(voteService).getVoteStatus(null, 101);
    }

    @Test
    @DisplayName("GET /api/v1/contents/{contentId}/vote -> Thành viên đăng nhập lấy trạng thái vote thành công")
    void getVoteStatus_WithAuthenticatedUser_ReturnsOk() {
        VoteResponse voteResponse = VoteResponse.builder()
                .contentId(101)
                .voteCount(13L)
                .isVoted(true)
                .build();

        when(voteService.getVoteStatus("truong", 101)).thenReturn(voteResponse);

        ResponseEntity<ApiResponse<VoteResponse>> response = voteController.getVoteStatus(authenticatedUser, 101);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().getData().getIsVoted());
        verify(voteService).getVoteStatus("truong", 101);
    }

    @Test
    @DisplayName("POST /api/v1/votes/toggle với query param -> Thành công chuyển tiếp tới VoteService")
    void toggleVoteDirect_WithQueryParam_ReturnsOk() {
        VoteResponse voteResponse = VoteResponse.builder()
                .contentId(202)
                .voteCount(1L)
                .isVoted(true)
                .build();

        when(voteService.toggleVote("truong", 202)).thenReturn(voteResponse);

        ResponseEntity<ApiResponse<VoteResponse>> response =
                voteController.toggleVoteDirect(authenticatedUser, 202, null);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().isSuccess());
        verify(voteService).toggleVote("truong", 202);
    }

    @Test
    @DisplayName("POST /api/v1/votes/toggle với body request -> Thành công chuyển tiếp tới VoteService")
    void toggleVoteDirect_WithRequestBody_ReturnsOk() {
        VoteResponse voteResponse = VoteResponse.builder()
                .contentId(202)
                .voteCount(0L)
                .isVoted(false)
                .build();

        when(voteService.toggleVote("truong", 202)).thenReturn(voteResponse);

        VoteToggleRequest request = new VoteToggleRequest(202);
        ResponseEntity<ApiResponse<VoteResponse>> response =
                voteController.toggleVoteDirect(authenticatedUser, null, request);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertFalse(response.getBody().getData().getIsVoted());
        verify(voteService).toggleVote("truong", 202);
    }

    @Test
    @DisplayName("POST /api/v1/votes/toggle không truyền contentId -> Ném BadRequestException")
    void toggleVoteDirect_WithoutContentId_ThrowsBadRequestException() {
        assertThrows(BadRequestException.class, () ->
                voteController.toggleVoteDirect(authenticatedUser, null, null));
    }
}
