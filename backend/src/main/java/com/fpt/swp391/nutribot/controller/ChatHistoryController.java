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
    @PostMapping("/sessions") public ResponseEntity<ApiResponse<ChatSessionResponse>> createSession(Authentication auth) { return ResponseEntity.ok(ApiResponse.success("Đã tạo cuộc trò chuyện", chatHistoryService.createSession(auth.getName()))); }
    @GetMapping("/sessions") public ResponseEntity<ApiResponse<List<ChatSessionResponse>>> getSessions(Authentication auth) { return ResponseEntity.ok(ApiResponse.success(chatHistoryService.getSessions(auth.getName()))); }
    @GetMapping("/sessions/{sessionId}/messages") public ResponseEntity<ApiResponse<List<ChatMessageResponse>>> getMessages(Authentication auth, @PathVariable Integer sessionId) { return ResponseEntity.ok(ApiResponse.success(chatHistoryService.getMessages(auth.getName(), sessionId))); }
    @PostMapping("/sessions/{sessionId}/messages") public ResponseEntity<ApiResponse<ChatMessageResponse>> addMessage(Authentication auth, @PathVariable Integer sessionId, @Valid @RequestBody ChatMessageCreateRequest request) { return ResponseEntity.ok(ApiResponse.success("Đã lưu tin nhắn", chatHistoryService.addMessage(auth.getName(), sessionId, request))); }
}
