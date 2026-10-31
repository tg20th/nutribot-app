package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.NotificationResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Content;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử danh sách thông báo tương tác (NB-83)")
class NotificationListTest {

    @Mock
    private NotificationRepository notificationRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ContentRepository contentRepository;

    private NotificationService notificationService;

    private static final LocalDateTime BASE_TIME = LocalDateTime.of(2026, 10, 21, 10, 0, 0);

    @BeforeEach
    void setUp() {
        notificationService = new NotificationService(notificationRepository, userRepository, contentRepository);
    }

    private User user(int id, String username) {
        return User.builder().userId(id).username(username).fullName("User " + username).build();
    }

    private Content content(int id, User author, String contentType, String title) {
        return Content.builder()
                .contentId(id)
                .contentType(contentType)
                .status("published")
                .title(title)
                .slug("bai-viet-" + id)
                .user(author)
                .build();
    }

    private Notification notification(int id, User recipient, User actor, String type,
                                     String referenceType, Integer referenceId,
                                     LocalDateTime createdAt, LocalDateTime updatedAt) {
        return Notification.builder()
                .notificationId(id)
                .recipient(recipient)
                .actor(actor)
                .type(type)
                .referenceType(referenceType)
                .referenceId(referenceId)
                .createdAt(createdAt)
                .updatedAt(updatedAt)
                .build();
    }

    private void mockPage(List<Notification> notifications) {
        Page<Notification> page = new PageImpl<>(notifications, PageRequest.of(0, 10), notifications.size());
        when(notificationRepository.findByRecipientIdOrderByActivityDesc(eq(1), any(Pageable.class))).thenReturn(page);
    }

    @Test
    @DisplayName("Danh sách -> Trả contentTitle và contentType của bài viết được vote")
    void listMyNotifications_ReturnsContentTitleAndContentType() {
        User author = user(1, "author");
        User actor = user(2, "actor");
        mockPage(List.of(notification(1, author, actor,
                NotificationService.TYPE_CONTENT_VOTED, NotificationService.REFERENCE_TYPE_CONTENT, 10,
                BASE_TIME, BASE_TIME)));
        when(contentRepository.findAllById(any())).thenReturn(List.of(content(10, author, "BLOG", "Cách làm Phở nữa")));

        PagedResponse<NotificationResponse> result = notificationService.listMyNotifications(1, 0, 10);

        assertEquals(1, result.getContent().size());
        NotificationResponse response = result.getContent().get(0);
        assertEquals("Cách làm Phở nữa", response.getContentTitle());
        assertEquals("BLOG", response.getContentType());
        assertEquals(BASE_TIME, response.getUpdatedAt());
        assertEquals(10, response.getReferenceId());
    }

    @Test
    @DisplayName("Danh sách -> Trả contentType VIDEO cho bài video")
    void listMyNotifications_ReturnsVideoContentType() {
        User author = user(1, "author");
        User actor = user(2, "actor");
        mockPage(List.of(notification(1, author, actor,
                NotificationService.TYPE_CONTENT_COMMENTED, NotificationService.REFERENCE_TYPE_CONTENT, 11,
                BASE_TIME, BASE_TIME)));
        when(contentRepository.findAllById(any())).thenReturn(List.of(content(11, author, "VIDEO", "Video nấu món")));

        NotificationResponse response = notificationService.listMyNotifications(1, 0, 10).getContent().get(0);

        assertEquals("VIDEO", response.getContentType());
        assertEquals("Video nấu món", response.getContentTitle());
    }

    @Test
    @DisplayName("Thông báo duyệt công thức (NB-81) -> Không có contentTitle/contentType, không lỗi")
    void listMyNotifications_RecipeSuggestionNotification_HasNoContentInfo() {
        User author = user(1, "author");
        User admin = user(9, "admin");
        mockPage(List.of(notification(1, author, admin,
                NotificationService.TYPE_RECIPE_SUGGESTION_APPROVED,
                NotificationService.REFERENCE_TYPE_CONTENT_RECIPE_SUGGESTION, 55,
                BASE_TIME, BASE_TIME)));

        PagedResponse<NotificationResponse> result = notificationService.listMyNotifications(1, 0, 10);

        NotificationResponse response = result.getContent().get(0);
        assertEquals(NotificationService.TYPE_RECIPE_SUGGESTION_APPROVED, response.getType());
        assertNull(response.getContentTitle());
        assertNull(response.getContentType());
        verify(contentRepository, never()).findAllById(any());
    }

    @Test
    @DisplayName("Sắp xếp -> Truy vấn danh sách dùng ORDER BY updated_at DESC, Pageable không gắn Sort")
    void listMyNotifications_UsesUpdatedAtOrderingWithoutDuplicateSort() throws Exception {
        User author = user(1, "author");
        mockPage(List.of(notification(1, author, null,
                NotificationService.TYPE_CONTENT_VOTED, NotificationService.REFERENCE_TYPE_CONTENT, 10,
                BASE_TIME, BASE_TIME)));
        when(contentRepository.findAllById(any())).thenReturn(List.of());

        notificationService.listMyNotifications(1, 0, 10);

        Method method = NotificationRepository.class
                .getMethod("findByRecipientIdOrderByActivityDesc", Integer.class, Pageable.class);
        Query query = method.getAnnotation(Query.class);
        assertNotNull(query, "Phai co @Query khai bao thu tu sap xep theo updated_at");
        assertTrue(query.value().contains("ORDER BY COALESCE(n.updatedAt, n.createdAt) DESC"),
                "Thu tu sap xep phai theo updated_at DESC, hien tai: " + query.value());

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(notificationRepository).findByRecipientIdOrderByActivityDesc(eq(1), pageableCaptor.capture());
        assertTrue(pageableCaptor.getValue().getSort().isUnsorted(),
                "Pageable khong duoc them Sort de tranh loi cot trung trong ORDER BY");
    }

    @Test
    @DisplayName("Chống N+1 -> Tải thông tin bài viết bằng 1 truy vấn cho cả trang")
    void listMyNotifications_FetchesContentsInSingleBatch() {
        User author = user(1, "author");
        User actor = user(2, "actor");
        mockPage(List.of(
                notification(1, author, actor, NotificationService.TYPE_CONTENT_VOTED,
                        NotificationService.REFERENCE_TYPE_CONTENT, 10, BASE_TIME, BASE_TIME),
                notification(2, author, actor, NotificationService.TYPE_CONTENT_COMMENTED,
                        NotificationService.REFERENCE_TYPE_CONTENT, 11, BASE_TIME, BASE_TIME),
                notification(3, author, actor, NotificationService.TYPE_CONTENT_VOTED,
                        NotificationService.REFERENCE_TYPE_CONTENT, 10, BASE_TIME, BASE_TIME)));
        when(contentRepository.findAllById(any())).thenReturn(List.of(
                content(10, author, "BLOG", "Bài 1"),
                content(11, author, "BLOG", "Bài 2")));

        notificationService.listMyNotifications(1, 0, 10);

        verify(contentRepository, times(1)).findAllById(any());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<Integer>> idCaptor = ArgumentCaptor.forClass(Iterable.class);
        verify(contentRepository).findAllById(idCaptor.capture());
        Set<Integer> queriedIds = new HashSet<>();
        idCaptor.getValue().forEach(queriedIds::add);
        assertEquals(Set.of(10, 11), queriedIds);
    }

    @Test
    @DisplayName("Bài viết đã bị xoá -> contentTitle/contentType null, không lỗi")
    void listMyNotifications_DeletedContent_ReturnsNullContentInfo() {
        User author = user(1, "author");
        User actor = user(2, "actor");
        mockPage(List.of(notification(1, author, actor,
                NotificationService.TYPE_CONTENT_VOTED, NotificationService.REFERENCE_TYPE_CONTENT, 10,
                BASE_TIME, BASE_TIME)));
        when(contentRepository.findAllById(any())).thenReturn(List.of());

        NotificationResponse response = notificationService.listMyNotifications(1, 0, 10).getContent().get(0);

        assertNull(response.getContentTitle());
        assertNull(response.getContentType());
        assertNotNull(response.getUpdatedAt());
    }

    @Test
    @DisplayName("Dữ liệu cũ chưa có updated_at -> updatedAt lấy fallback từ createdAt")
    void listMyNotifications_NullUpdatedAt_FallsBackToCreatedAt() {
        User author = user(1, "author");
        mockPage(List.of(notification(1, author, null,
                NotificationService.TYPE_CONTENT_VOTED, NotificationService.REFERENCE_TYPE_CONTENT, 10,
                BASE_TIME, null)));
        when(contentRepository.findAllById(any())).thenReturn(List.of());

        NotificationResponse response = notificationService.listMyNotifications(1, 0, 10).getContent().get(0);

        assertEquals(BASE_TIME, response.getUpdatedAt());
    }

    @Test
    @DisplayName("Tham số phân trang -> page âm được chuyển về 0, size vượt quá 50 bị giới hạn")
    void listMyNotifications_ClampsPagingParameters() {
        User author = user(1, "author");
        mockPage(List.of(notification(1, author, null,
                NotificationService.TYPE_CONTENT_VOTED, NotificationService.REFERENCE_TYPE_CONTENT, 10,
                BASE_TIME, BASE_TIME)));
        when(contentRepository.findAllById(any())).thenReturn(List.of());

        notificationService.listMyNotifications(1, -5, 999);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(notificationRepository).findByRecipientIdOrderByActivityDesc(eq(1), pageableCaptor.capture());
        assertEquals(0, pageableCaptor.getValue().getPageNumber());
        assertEquals(50, pageableCaptor.getValue().getPageSize());
    }

    @Test
    @DisplayName("Gom vote vào thông báo cũ -> Tăng updatedAt và xoá readAt để thông báo lên đầu danh sách")
    void notifyContentVoted_GroupedVote_BumpsUpdatedAtAndClearsReadAt() {
        User author = user(1, "author");
        User voter = user(2, "voter");
        LocalDateTime lastActivity = LocalDateTime.now().minusMinutes(5);
        Notification existing = notification(1, author, voter,
                NotificationService.TYPE_CONTENT_VOTED, NotificationService.REFERENCE_TYPE_CONTENT, 10,
                lastActivity, lastActivity);
        existing.setReadAt(LocalDateTime.now().minusMinutes(1));

        when(contentRepository.findByIdForUpdate(10)).thenReturn(Optional.of(content(10, author, "BLOG", "Bài viết")));
        when(userRepository.findById(1)).thenReturn(Optional.of(author));
        when(userRepository.findById(2)).thenReturn(Optional.of(voter));
        when(notificationRepository.findLatestForGrouping(
                eq(1), eq(NotificationService.TYPE_CONTENT_VOTED), eq(NotificationService.REFERENCE_TYPE_CONTENT),
                eq(10), any(Pageable.class))).thenReturn(List.of(existing));

        notificationService.notifyContentVoted(10, 2);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        Notification saved = captor.getValue();
        assertNull(saved.getReadAt(), "Thong bao gom vote phai duoc danh dau chua doc lai");
        assertTrue(saved.getUpdatedAt().isAfter(saved.getCreatedAt()),
                "updatedAt phai moi hon createdAt de thong bao len dau danh sach");
    }

    @Test
    @DisplayName("WARN recipient -> vẫn nhận được notification tương tác")
    void warnRecipient_ReceivesInteractionNotification() {
        User author = user(1, "warn-author");
        author.setStatus(AccountStatus.WARN);
        User voter = user(2, "voter");
        when(contentRepository.findByIdForUpdate(10)).thenReturn(Optional.of(content(10, author, "BLOG", "Bài viết WARN")));
        when(userRepository.findById(1)).thenReturn(Optional.of(author));
        when(userRepository.findById(2)).thenReturn(Optional.of(voter));
        when(notificationRepository.findLatestForGrouping(
                eq(1), eq(NotificationService.TYPE_CONTENT_VOTED), eq(NotificationService.REFERENCE_TYPE_CONTENT),
                eq(10), any(Pageable.class))).thenReturn(List.of());

        notificationService.notifyContentVoted(10, 2);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        assertSame(author, captor.getValue().getRecipient());
        assertEquals(AccountStatus.WARN, captor.getValue().getRecipient().getStatus());
    }
}
