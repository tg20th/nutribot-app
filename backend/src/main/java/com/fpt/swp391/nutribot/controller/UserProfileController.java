package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.AvatarResponse;
import com.fpt.swp391.nutribot.dto.request.ProfileUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.UserProfileResponse;
import com.fpt.swp391.nutribot.service.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;

@RestController
@RequestMapping("/api/v1/users/profile")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserProfileService userProfileService;

    @GetMapping
    public ResponseEntity<ApiResponse<UserProfileResponse>> getProfile(Principal principal) {
        UserProfileResponse response = userProfileService.getProfile(principal.getName());
        return ResponseEntity.ok(ApiResponse.success("Profile loaded successfully.", response));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateProfile(
            Principal principal,
            @Valid @RequestBody ProfileUpdateRequest request) {
        UserProfileResponse response = userProfileService.updateProfile(principal.getName(), request);
        return ResponseEntity.ok(ApiResponse.success("Profile updated successfully.", response));
    }

    @PutMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<AvatarResponse>> updateAvatar(
            Principal principal,
            @RequestParam("file") MultipartFile file) {
        AvatarResponse response = userProfileService.updateAvatar(principal.getName(), file);
        return ResponseEntity.ok(ApiResponse.success("Avatar updated successfully.", response));
    }

    @DeleteMapping("/avatar")
    public ResponseEntity<ApiResponse<AvatarResponse>> deleteAvatar(Principal principal) {
        AvatarResponse response = userProfileService.deleteAvatar(principal.getName());
        return ResponseEntity.ok(ApiResponse.success("Avatar removed successfully.", response));
    }
}
