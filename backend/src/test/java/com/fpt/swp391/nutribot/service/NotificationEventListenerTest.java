package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.event.RecipeSuggestionReviewedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử listener thông báo duyệt đề xuất công thức (NB-87)")
class NotificationEventListenerTest {

    @Mock
    private NotificationService notificationService;

    private NotificationEventListener listener;

    @BeforeEach
    void setUp() {
        listener = new NotificationEventListener(notificationService);
    }

    private RecipeSuggestionReviewedEvent event() {
        return new RecipeSuggestionReviewedEvent(700, 82, 9, 1, "APPROVE", "Bún gạo lứt", "Bài viết", null);
    }

    @Test
    @DisplayName("Sự kiện hợp lệ được chuyển cho NotificationService")
    void onRecipeSuggestionReviewed_delegatesToService() {
        listener.onRecipeSuggestionReviewed(event());

        verify(notificationService).createForRecipeSuggestionReviewed(
                9, 1, 700, "APPROVE", 82, "Bún gạo lứt", "Bài viết", null);
    }

    @Test
    @DisplayName("Sự kiện null không gọi service")
    void onRecipeSuggestionReviewed_ignoresNull() {
        listener.onRecipeSuggestionReviewed(null);

        verify(notificationService, never()).createForRecipeSuggestionReviewed(
                anyInt(), anyInt(), anyInt(), anyString(), anyInt(), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Lỗi gửi thông báo sau commit không được ném ra ngoài")
    void onRecipeSuggestionReviewed_swallowsNotificationFailure() {
        doThrow(new IllegalStateException("mail down")).when(notificationService)
                .createForRecipeSuggestionReviewed(
                        9, 1, 700, "APPROVE", 82, "Bún gạo lứt", "Bài viết", null);

        assertDoesNotThrow(() -> listener.onRecipeSuggestionReviewed(event()));
        verify(notificationService).createForRecipeSuggestionReviewed(
                9, 1, 700, "APPROVE", 82, "Bún gạo lứt", "Bài viết", null);
    }
}
