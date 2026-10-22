package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.AuthorRecipeSuggestionResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.service.AuthorRecipeSuggestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * NB-84: Tac gia theo doi trang thai de xuat cong thuc cua bai viet cua minh.
 * Chi tra ve du xuat thuoc ve chinh nguoi dang dang nhap.
 */
@RestController
@RequestMapping("/api/v1/author/recipe-suggestions")
@RequiredArgsConstructor
public class AuthorRecipeSuggestionController {

    private final AuthorRecipeSuggestionService authorRecipeSuggestionService;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<AuthorRecipeSuggestionResponse>>> getMySuggestions(
            @AuthenticationPrincipal UserDetails user,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PagedResponse<AuthorRecipeSuggestionResponse> response =
                authorRecipeSuggestionService.listMySuggestions(user.getUsername(), status, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AuthorRecipeSuggestionResponse>> getMySuggestion(
            @AuthenticationPrincipal UserDetails user,
            @PathVariable Integer id) {
        AuthorRecipeSuggestionResponse response = authorRecipeSuggestionService.getMySuggestion(user.getUsername(), id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
