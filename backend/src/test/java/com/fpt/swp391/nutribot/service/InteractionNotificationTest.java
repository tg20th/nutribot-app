package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.Notification;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.event.ContentCommentedEvent;
import com.fpt.swp391.nutribot.event.ContentVotedEvent;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.NotificationRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử Notification tương tác vote/comment (NB-83)")
class InteractionNotificationTest {

    @Mock
    private NotificationRepository notificationRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ContentRepository contentRepository;
    @Mock
    private NotificationService notificationService;

    private NotificationService realNotificationService;
    private InteractionNotificationListener listener;

    @BeforeEach
    void setUp() {
        realNotificationService = new NotificationService(notificationRepository, userRepository, contentRepository);
        listener = new InteractionNotificationListener(notificationService);
    }

    private User user(int id, String username) {
        return User.builder().userId(id).username(username).fullName("User " + username).build();
    }

    private Content content(int id, User author) {
        return Content.builder()
                .contentId(id)
                .contentType("BLOG")
                .status("published")
                .title("Bài viết")
                .slug("bai-viet-" + id)
                .user(author)
                .build();
    }

    private void mockContent(int contentId, User author) {
        when(contentRepository.findByIdForUpdate(contentId)).thenReturn(Optional.of(content(contentId, author)));
    }

    private void mockGrouping(Integer recipientId, String type, Integer referenceId, Notification notification) {
        when(notificationRepository.findLatestForGrouping(
                eq(recipientId), eq(type), eq(NotificationService.REFERENCE_TYPE_CONTENT), eq(referenceId), any(Pageable.class)))
                .thenReturn(notification == null ? Collections.emptyList() : Collections.singletonList(notification));
    }

    @Nested
    @DisplayName("Gộp vote gần nhau và chống spam")
    class VoteGroupingTests {

        @Test
        @DisplayName("Vote hợp lệ lần đầu -> Tạo notification CONTENT_VOTED cho tác giả")
        void notifyContentVoted_FirstVote_CreatesNotification() {
            User author = user(1, "author");
            User voter = user(2, "voter");
            mockContent(10, author);
            when(userRepository.findById(1)).thenReturn(Optional.of(author));
            when(userRepository.findById(2)).thenReturn(Optional.of(voter));
            mockGrouping(1, NotificationService.TYPE_CONTENT_VOTED, 10, null);

            realNotificationService.notifyContentVoted(10, 2);

            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository).save(captor.capture());
            Notification saved = captor.getValue();
            assertEquals(NotificationService.TYPE_CONTENT_VOTED, saved.getType());
            assertEquals(NotificationService.REFERENCE_TYPE_CONTENT, saved.getReferenceType());
            assertEquals(10, saved.getReferenceId());
            assertEquals(author, saved.getRecipient());
            assertEquals(voter, saved.getActor());
            assertNull(saved.getReadAt());
            assertNotNull(saved.getCreatedAt());
            assertNotNull(saved.getUpdatedAt());
            assertEquals(saved.getCreatedAt(), saved.getUpdatedAt());
        }

        @Test
        @DisplayName("Nhiều vote gần nhau trong 30 phút -> Gộp vào 1 notification, không tạo mới")
        void notifyContentVoted_RecentVote_ReusesExistingNotification() {
            User author = user(1, "author");
            User voter = user(2, "voter");
            Notification existing = Notification.builder()
                    .notificationId(99)
                    .recipient(author)
                    .actor(voter)
                    .type(NotificationService.TYPE_CONTENT_VOTED)
                    .referenceType(NotificationService.REFERENCE_TYPE_CONTENT)
                    .referenceId(10)
                    .createdAt(LocalDateTime.now().minusMinutes(5))
                    .updatedAt(LocalDateTime.now().minusMinutes(5))
                    .build();

            mockContent(10, author);
            when(userRepository.findById(1)).thenReturn(Optional.of(author));
            when(userRepository.findById(2)).thenReturn(Optional.of(voter));
            mockGrouping(1, NotificationService.TYPE_CONTENT_VOTED, 10, existing);
            LocalDateTime previousActivity = existing.getUpdatedAt();

            realNotificationService.notifyContentVoted(10, 2);

            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository).save(captor.capture());
            Notification saved = captor.getValue();
            assertEquals(99, saved.getNotificationId());
            assertEquals(NotificationService.TYPE_CONTENT_VOTED, saved.getType());
            assertEquals(10, saved.getReferenceId());
            assertTrue(saved.getUpdatedAt().isAfter(previousActivity));
        }

        @Test
        @DisplayName("Notification đã đọc gặp vote mới -> Đánh dấu chưa đọc lại để tác giả không bỏ lỡ")
        void notifyContentVoted_ReadNotification_ResetsReadAt() {
            User author = user(1, "author");
            User voter = user(2, "voter");
            LocalDateTime readMoment = LocalDateTime.now().minusMinutes(10);
            Notification existing = Notification.builder()
                    .notificationId(99)
                    .recipient(author)
                    .actor(voter)
                    .type(NotificationService.TYPE_CONTENT_VOTED)
                    .referenceType(NotificationService.REFERENCE_TYPE_CONTENT)
                    .referenceId(10)
                    .readAt(readMoment)
                    .createdAt(LocalDateTime.now().minusMinutes(20))
                    .updatedAt(LocalDateTime.now().minusMinutes(20))
                    .build();

            mockContent(10, author);
            when(userRepository.findById(1)).thenReturn(Optional.of(author));
            when(userRepository.findById(2)).thenReturn(Optional.of(voter));
            mockGrouping(1, NotificationService.TYPE_CONTENT_VOTED, 10, existing);

            realNotificationService.notifyContentVoted(10, 2);

            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository).save(captor.capture());
            assertNull(captor.getValue().getReadAt());
        }

        @Test
        @DisplayName("Vote sau 30 phút -> Tạo notification mới")
        void notifyContentVoted_OldVote_CreatesNewNotification() {
            User author = user(1, "author");
            User voter = user(2, "voter");
            Notification old = Notification.builder()
                    .notificationId(99)
                    .recipient(author)
                    .actor(voter)
                    .type(NotificationService.TYPE_CONTENT_VOTED)
                    .referenceType(NotificationService.REFERENCE_TYPE_CONTENT)
                    .referenceId(10)
                    .createdAt(LocalDateTime.now().minusHours(3))
                    .updatedAt(LocalDateTime.now().minusHours(3))
                    .build();

            mockContent(10, author);
            when(userRepository.findById(1)).thenReturn(Optional.of(author));
            when(userRepository.findById(2)).thenReturn(Optional.of(voter));
            mockGrouping(1, NotificationService.TYPE_CONTENT_VOTED, 10, old);

            realNotificationService.notifyContentVoted(10, 2);

            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository).save(captor.capture());
            Notification saved = captor.getValue();
            assertNull(saved.getNotificationId());
            assertEquals(NotificationService.TYPE_CONTENT_VOTED, saved.getType());
        }

        @Test
        @DisplayName("Tác giả tự vote bài của mình -> Không tạo notification")
        void notifyContentVoted_SelfVote_DoesNotCreateNotification() {
            User author = user(1, "author");
            mockContent(10, author);

            realNotificationService.notifyContentVoted(10, 1);

            verify(notificationRepository, never()).save(any());
            verify(userRepository, never()).findById(anyInt());
        }

        @Test
        @DisplayName("Nội dung không tồn tại -> Không tạo notification")
        void notifyContentVoted_ContentNotFound_DoesNotCreateNotification() {
            when(contentRepository.findByIdForUpdate(10)).thenReturn(Optional.empty());

            realNotificationService.notifyContentVoted(10, 2);

            verify(notificationRepository, never()).save(any());
        }

        @Test
        @DisplayName("Thiếu contentId hoặc voterId -> Bỏ qua an toàn")
        void notifyContentVoted_InvalidInput_Skips() {
            realNotificationService.notifyContentVoted(null, 2);
            realNotificationService.notifyContentVoted(10, null);

            verify(notificationRepository, never()).save(any());
            verify(contentRepository, never()).findByIdForUpdate(anyInt());
        }
    }

    @Nested
    @DisplayName("Notification từ bình luận")
    class CommentNotificationTests {

        @Test
        @DisplayName("Bình luận hợp lệ -> Tạo notification CONTENT_COMMENTED cho tác giả")
        void notifyContentCommented_ValidComment_CreatesNotification() {
            User author = user(1, "author");
            User commenter = user(3, "commenter");
            mockContent(20, author);
            when(userRepository.findById(1)).thenReturn(Optional.of(author));
            when(userRepository.findById(3)).thenReturn(Optional.of(commenter));

            realNotificationService.notifyContentCommented(20, 3);

            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            verify(notificationRepository).save(captor.capture());
            Notification saved = captor.getValue();
            assertEquals(NotificationService.TYPE_CONTENT_COMMENTED, saved.getType());
            assertEquals(NotificationService.REFERENCE_TYPE_CONTENT, saved.getReferenceType());
            assertEquals(20, saved.getReferenceId());
            assertEquals(author, saved.getRecipient());
            assertEquals(commenter, saved.getActor());
            assertNull(saved.getReadAt());
        }

        @Test
        @DisplayName("Tác giả tự bình luận bài của mình -> Không tạo notification")
        void notifyContentCommented_SelfComment_DoesNotCreateNotification() {
            User author = user(1, "author");
            mockContent(20, author);

            realNotificationService.notifyContentCommented(20, 1);

            verify(notificationRepository, never()).save(any());
            verify(userRepository, never()).findById(anyInt());
        }

        @Test
        @DisplayName("Nội dung không tồn tại -> Không tạo notification")
        void notifyContentCommented_ContentNotFound_DoesNotCreateNotification() {
            when(contentRepository.findByIdForUpdate(20)).thenReturn(Optional.empty());

            realNotificationService.notifyContentCommented(20, 3);

            verify(notificationRepository, never()).save(any());
        }

        @Test
        @DisplayName("Thiếu contentId hoặc commenterId -> Bỏ qua an toàn")
        void notifyContentCommented_InvalidInput_Skips() {
            realNotificationService.notifyContentCommented(null, 3);
            realNotificationService.notifyContentCommented(20, null);

            verify(notificationRepository, never()).save(any());
            verify(contentRepository, never()).findByIdForUpdate(anyInt());
        }
    }

    @Nested
    @DisplayName("Listener xử lý event sau commit")
    class ListenerTests {

        @Test
        @DisplayName("Event vote -> Gọi notifyContentVoted với contentId và voterId")
        void onContentVoted_CallsNotifyWithContentAndVoter() {
            listener.onContentVoted(new ContentVotedEvent(10, 2));

            verify(notificationService).notifyContentVoted(10, 2);
        }

        @Test
        @DisplayName("Event comment -> Gọi notifyContentCommented với contentId và commenterId")
        void onContentCommented_CallsNotifyWithContentAndCommenter() {
            listener.onContentCommented(new ContentCommentedEvent(20, 3, 500, null));

            verify(notificationService).notifyContentCommented(20, 3);
        }

        @Test
        @DisplayName("Event null hoặc thiếu id -> Bỏ qua an toàn")
        void onEvents_InvalidPayload_Skips() {
            listener.onContentVoted(null);
            listener.onContentVoted(new ContentVotedEvent(null, 2));
            listener.onContentVoted(new ContentVotedEvent(10, null));
            listener.onContentCommented(null);
            listener.onContentCommented(new ContentCommentedEvent(null, 3, 500, null));
            listener.onContentCommented(new ContentCommentedEvent(20, null, 500, null));

            verify(notificationService, never()).notifyContentVoted(anyInt(), anyInt());
            verify(notificationService, never()).notifyContentCommented(anyInt(), anyInt());
        }

        @Test
        @DisplayName("Event có đủ id -> Gọi đúng hàm tương ứng với loại event")
        void onEvents_ValidPayload_CallsMatchingMethod() {
            listener.onContentVoted(new ContentVotedEvent(10, 2));

            verify(notificationService).notifyContentVoted(10, 2);
            verify(notificationService, never()).notifyContentCommented(anyInt(), anyInt());
        }
    }
}
