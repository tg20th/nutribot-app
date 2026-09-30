package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.ChatMessageCreateRequest;
import com.fpt.swp391.nutribot.dto.response.*;
import com.fpt.swp391.nutribot.service.ChatHistoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/v1/chatbot") @RequiredArgsConstructor
public class ChatHistoryController {
    private final ChatHistoryService chatHistoryService;

    @PostMapping("/sessions")
    public ResponseEntity<ApiResponse<ChatSessionResponse>> createSession(Authentication auth) {
        return ResponseEntity.ok(ApiResponse.success("Đã tạo cuộc trò chuyện", chatHistoryService.createSession(auth.getName())));
    }

    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse<List<ChatSessionResponse>>> getSessions(Authentication auth) {
        return ResponseEntity.ok(ApiResponse.success(chatHistoryService.getSessions(auth.getName())));
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<Void>> deleteSession(Authentication auth, @PathVariable Integer sessionId) {
        chatHistoryService.deleteSession(auth.getName(), sessionId);
        return ResponseEntity.ok(ApiResponse.success("Đã xóa cuộc trò chuyện", null));
    }

    @GetMapping("/sessions/{sessionId}/messages")
    public ResponseEntity<ApiResponse<PagedResponse<ChatMessageResponse>>> getMessages(
            Authentication auth,
            @PathVariable Integer sessionId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(ApiResponse.success(chatHistoryService.getMessagesPaged(auth.getName(), sessionId, page, size)));
    }

    @PostMapping("/sessions/{sessionId}/messages")
    public ResponseEntity<ApiResponse<ChatMessageResponse>> addMessage(
            Authentication auth,
            @PathVariable Integer sessionId,
            @Valid @RequestBody ChatMessageCreateRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã lưu tin nhắn", chatHistoryService.addMessage(auth.getName(), sessionId, request)));
    }
}
