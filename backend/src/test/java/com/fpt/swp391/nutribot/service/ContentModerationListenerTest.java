package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.event.ContentModerationRequestedEvent;
import com.fpt.swp391.nutribot.repository.ContentModerationRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Kiểm thử ContentModerationListener — xử lý bất đồng bộ AI moderation
 * sau khi tác giả submit post (NB: post async, NB-65 follow-up).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử ContentModerationListener — bất đồng bộ AI moderation")
class ContentModerationListenerTest {

    @Mock
    private ContentRepository contentRepository;

    @Mock
    private ContentModerationGatewayService contentModerationGatewayService;

    @Mock
    private ContentModerationRepository contentModerationRepository;

    @Mock
    private com.fpt.swp391.nutribot.repository.CategoryRepository categoryRepository;

    private ContentModerationListener listener;

    private Content sampleContent;

    @BeforeEach
    void setUp() {
        listener = new ContentModerationListener(
                contentRepository,
                contentModerationGatewayService,
                contentModerationRepository,
                categoryRepository
        );

        User author = User.builder()
                .userId(1)
                .username("truong_author")
                .build();

        sampleContent = Content.builder()
                .contentId(100)
                .user(author)
                .contentType("BLOG")
                .title("7 Ngày Ăn Chay Thanh Lọc")
                .body("Nội dung bài viết...")
                .status("ai_processing")
                .build();
    }

    @Test
    @DisplayName("AI APPROVE -> chuyển trạng thái sang PUBLISHED")
    void handleModerationRequested_whenAiApprove_setsPublished() {
        when(contentRepository.findById(100)).thenReturn(Optional.of(sampleContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(contentModerationGatewayService.moderateContent(
                any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new ContentModerationGatewayService.ModerationResult(
                        "APPROVE", "Safe vegetarian content", 0.98, java.util.List.of("SAFE")));

        ContentModerationRequestedEvent event = new ContentModerationRequestedEvent(100, "BLOG", 1);
        listener.handleModerationRequested(event);

        assertEquals("published", sampleContent.getStatus());
        verify(contentRepository).save(sampleContent);
    }

    @Test
    @DisplayName("AI REJECT -> giữ UNDER_REVIEW để Admin duyệt lần 2")
    void handleModerationRequested_whenAiReject_keepsUnderReview() {
        when(contentRepository.findById(100)).thenReturn(Optional.of(sampleContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(contentModerationGatewayService.moderateContent(
                any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new ContentModerationGatewayService.ModerationResult(
                        "REJECT", "Non-vegetarian recipe", 0.95, java.util.List.of("NON_VEGETARIAN_CONTENT")));

        ContentModerationRequestedEvent event = new ContentModerationRequestedEvent(100, "BLOG", 1);
        listener.handleModerationRequested(event);

        assertEquals("under_review", sampleContent.getStatus());
        verify(contentRepository).save(sampleContent);
    }

    @Test
    @DisplayName("AI timeout/lỗi -> fallback NEEDS_REVIEW -> giữ UNDER_REVIEW")
    void handleModerationRequested_whenAiTimeout_keepsUnderReview() {
        when(contentRepository.findById(100)).thenReturn(Optional.of(sampleContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(contentModerationGatewayService.moderateContent(
                any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new ContentModerationGatewayService.ModerationResult(
                        "NEEDS_REVIEW", "AI service unavailable, manual review required",
                        0.5, java.util.List.of("TIMEOUT")));

        ContentModerationRequestedEvent event = new ContentModerationRequestedEvent(100, "BLOG", 1);
        listener.handleModerationRequested(event);

        assertEquals("under_review", sampleContent.getStatus());
        verify(contentRepository).save(sampleContent);
    }

    @Test
    @DisplayName("Content không tồn tại -> log warning và bỏ qua, không throw")
    void handleModerationRequested_contentNotFound_logsAndSkips() {
        when(contentRepository.findById(999)).thenReturn(Optional.empty());

        ContentModerationRequestedEvent event = new ContentModerationRequestedEvent(999, "BLOG", 1);
        assertDoesNotThrow(() -> listener.handleModerationRequested(event));

        verify(contentRepository, never()).save(any(Content.class));
        verify(contentModerationGatewayService, never()).moderateContent(
                any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("AI service throw exception -> bài vẫn được cập nhật về under_review (không stuck ai_processing)")
    void handleModerationRequested_whenAiServiceThrows_setsUnderReview() {
        when(contentRepository.findById(100)).thenReturn(Optional.of(sampleContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(contentModerationGatewayService.moderateContent(
                any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new RuntimeException("AI service connection refused"));

        ContentModerationRequestedEvent event = new ContentModerationRequestedEvent(100, "BLOG", 1);
        // Bài không bị stuck ở ai_processing — listener phải đảm bảo recovery
        assertDoesNotThrow(() -> listener.handleModerationRequested(event));

        assertEquals("under_review", sampleContent.getStatus());
        verify(contentRepository, atLeastOnce()).save(any(Content.class));
    }
}
