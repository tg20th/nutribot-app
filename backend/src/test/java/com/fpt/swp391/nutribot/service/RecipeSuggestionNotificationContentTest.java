package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.Notification;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.NotificationRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử nội dung thông báo duyệt công thức (NB-84)")
class RecipeSuggestionNotificationContentTest {

    @Mock
    private NotificationRepository notificationRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ContentRepository contentRepository;

    private NotificationService notificationService;

    @BeforeEach
    void setUp() {
        notificationService = new NotificationService(notificationRepository, userRepository, contentRepository);
    }

    private User user(int id, String username, String fullName) {
        return User.builder().userId(id).username(username).fullName(fullName).build();
    }

    @Test
    @DisplayName("NB-84: Duyệt công thức -> thông báo nói rõ công thức đã vào hệ thống")
    void approved_notificationContainsRecipeName() {
        when(userRepository.findById(9)).thenReturn(Optional.of(user(9, "author", "Tác giả")));
        when(userRepository.findById(1)).thenReturn(Optional.of(user(1, "admin", "Quản trị viên")));

        notificationService.createForRecipeSuggestionReviewed(
                9, 1, 700, "APPROVE", 82, "Phở nấm thuần chay", "Chia sẻ cách làm Phở nấm thuần chay", null);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        Notification notification = captor.getValue();
        assertEquals(NotificationService.TYPE_RECIPE_SUGGESTION_APPROVED, notification.getType());
        assertEquals(NotificationService.TITLE_SUGGESTION_APPROVED, notification.getTitle());
        assertTrue(notification.getMessage().contains("Phở nấm thuần chay"));
        assertTrue(notification.getMessage().contains("đã được duyệt và thêm vào hệ thống"));
        assertEquals("/community/posts/82", notification.getActionUrl());
    }

    @Test
    @DisplayName("NB-84: Từ chối công thức -> thông báo kèm lý do từ chối")
    void rejected_notificationContainsReason() {
        when(userRepository.findById(9)).thenReturn(Optional.of(user(9, "author", "Tác giả")));
        when(userRepository.findById(1)).thenReturn(Optional.of(user(1, "admin", "Quản trị viên")));

        notificationService.createForRecipeSuggestionReviewed(
                9, 1, 700, "REJECT", 82, "Phở nấm thuần chay", "Chia sẻ cách làm Phở nấm thuần chay",
                "Trùng món đã có trong hệ thống");

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        Notification notification = captor.getValue();
        assertEquals(NotificationService.TYPE_RECIPE_SUGGESTION_REJECTED, notification.getType());
        assertEquals(NotificationService.TITLE_SUGGESTION_REJECTED, notification.getTitle());
        assertTrue(notification.getMessage().contains("Trùng món đã có trong hệ thống"));
        assertTrue(notification.getMessage().contains("chưa được duyệt"));
        assertEquals("/community/posts/82", notification.getActionUrl());
    }

    @Test
    @DisplayName("NB-84: Thiếu tên món/tiêu đề vẫn tạo được thông báo đọc được")
    void notificationWithoutOptionalFields_stillReadable() {
        when(userRepository.findById(9)).thenReturn(Optional.of(user(9, "author", "Tác giả")));

        notificationService.createForRecipeSuggestionReviewed(9, null, 700, "APPROVE", null, null, null, null);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        Notification notification = captor.getValue();
        assertNotNull(notification.getMessage());
        assertFalse(notification.getMessage().isBlank());
        assertNull(notification.getActionUrl());
    }

    @Test
    @DisplayName("NB-84: Không tạo thông báo khi thiếu tác giả hoặc thiếu đề xuất")
    void notificationSkippedWhenInvalid() {
        notificationService.createForRecipeSuggestionReviewed(null, 1, 700, "APPROVE", 82, "Món", "Bài", null);
        notificationService.createForRecipeSuggestionReviewed(9, 1, null, "APPROVE", 82, "Món", "Bài", null);

        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("NB-84: Đề xuất đóng tự động -> thông báo nói rõ đã đóng và kèm lý do")
    void closed_notificationContainsReason() {
        when(userRepository.findById(9)).thenReturn(Optional.of(user(9, "author", "Tác giả")));

        notificationService.createForRecipeSuggestionClosed(
                9, 700, 82, "Phở nấm thuần chay", "Chia sẻ cách làm Phở nấm thuần chay",
                RecipeConsentRevocationService.REASON_CONSENT_REVOKED);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        Notification notification = captor.getValue();
        assertEquals(NotificationService.TYPE_RECIPE_SUGGESTION_REJECTED, notification.getType());
        assertEquals(NotificationService.TITLE_SUGGESTION_CLOSED, notification.getTitle());
        assertTrue(notification.getMessage().contains("Phở nấm thuần chay"));
        assertTrue(notification.getMessage().contains("đã được đóng"));
        assertTrue(notification.getMessage().contains(RecipeConsentRevocationService.REASON_CONSENT_REVOKED));
        assertEquals("/community/posts/82", notification.getActionUrl());
    }

    @Test
    @DisplayName("NB-84: Đề xuất đóng tự động mà không có tên món vẫn tạo được thông báo")
    void closed_notificationWithoutOptionalFields_stillReadable() {
        when(userRepository.findById(9)).thenReturn(Optional.of(user(9, "author", "Tác giả")));

        notificationService.createForRecipeSuggestionClosed(9, 700, null, null, null, null);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        Notification notification = captor.getValue();
        assertFalse(notification.getMessage().isBlank());
        assertNull(notification.getActionUrl());
    }
}
