package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.VoteResponse;
import com.fpt.swp391.nutribot.service.VoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class VoteController {

    private final VoteService voteService;

    @PostMapping("/api/v1/contents/{contentId}/vote")
    public ResponseEntity<ApiResponse<VoteResponse>> toggleVote(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer contentId) {
        VoteResponse response = voteService.toggleVote(user.getUsername(), contentId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/api/v1/contents/{contentId}/vote")
    public ResponseEntity<ApiResponse<VoteResponse>> getVoteStatus(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer contentId) {
        String username = user != null ? user.getUsername() : null;
        VoteResponse response = voteService.getVoteStatus(username, contentId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
