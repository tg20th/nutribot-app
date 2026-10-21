package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.ContentListResponse;
import com.fpt.swp391.nutribot.dto.response.MyRecipeResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.dto.response.PublicUserProfileResponse;
import com.fpt.swp391.nutribot.service.PublicProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class PublicUserController {

    private final PublicProfileService publicProfileService;

    @GetMapping("/{username}")
    public ResponseEntity<ApiResponse<PublicUserProfileResponse>> getPublicProfile(@PathVariable String username) {
        PublicUserProfileResponse response = publicProfileService.getPublicProfile(username);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{username}/posts")
    public ResponseEntity<ApiResponse<PagedResponse<ContentListResponse>>> getPublicPosts(
            @PathVariable String username,
            @RequestParam String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PagedResponse<ContentListResponse> response = publicProfileService.getPublicPosts(username, type, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{username}/recipes")
    public ResponseEntity<ApiResponse<List<MyRecipeResponse>>> getPublicRecipes(@PathVariable String username) {
        List<MyRecipeResponse> response = publicProfileService.getPublicRecipes(username);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
