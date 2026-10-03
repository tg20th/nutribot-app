package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.PersonalizedFeedResponse;
import com.fpt.swp391.nutribot.service.PersonalizedFeedService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/feed")
@RequiredArgsConstructor
public class PersonalizedFeedController {

    private final PersonalizedFeedService personalizedFeedService;

    @GetMapping("/home")
    public ResponseEntity<ApiResponse<PersonalizedFeedResponse>> getPersonalizedFeed(
            @RequestParam(required = false, defaultValue = "20") Integer limit,
            @RequestParam(required = false) String cursor) {

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();

        PersonalizedFeedResponse response = personalizedFeedService.getPersonalizedFeed(username, limit, cursor);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
