package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.AdminModerationRequest;
import com.fpt.swp391.nutribot.dto.response.AdminContentResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.ContentModeration;
import com.fpt.swp391.nutribot.entity.Role;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.ContentModerationRepository;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.repository.ModerationDecisionAuditRepository;
import com.fpt.swp391.nutribot.entity.ModerationDecisionAudit;
import com.fpt.swp391.nutribot.event.AccountSuspendedEvent;
import com.fpt.swp391.nutribot.entity.UserModerationAction;
import com.fpt.swp391.nutribot.repository.UserModerationActionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử AdminModerationService")
class AdminModerationServiceTest {

    @Mock
    private ContentRepository contentRepository;

    @Mock
    private ContentModerationRepository contentModerationRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserNotificationSender userNotificationSender;

    @Mock
    private NotificationService notificationService;

    @Mock
    private ModerationDecisionAuditRepository moderationDecisionAuditRepository;

    @Mock
    private UserModerationActionRepository userModerationActionRepository;

    @InjectMocks
    private AdminModerationService adminModerationService;

    private User sampleAuthor;
    private Content underReviewContent;
    private ContentModeration sampleModeration;
    private User sampleAdmin;

    @BeforeEach
    void setUp() {
        sampleAuthor = User.builder()
                .userId(1)
                .username("truong_author")
                .email("truong@example.com")
                .status(AccountStatus.ACTIVE)
                .build();

        underReviewContent = Content.builder()
                .contentId(10)
                .user(sampleAuthor)
                .contentType("BLOG")
                .title("Salad thanh đạm")
                .slug("salad-thanh-dam-10")
                .body("Rau củ tươi ngon")
                .thumbnailUrl("https://example.com/thumb.jpg")
                .status("under_review")
                .viewCount(5)
                .build();

        sampleModeration = ContentModeration.builder()
                .moderationId(1)
                .contentId(10)
                .aiFlagged(true)
                .aiReason("Phát hiện nguyên liệu cần kiểm tra thủ công")
                .aiConfidence(new BigDecimal("0.8500"))
                .status("pending")
                .build();
        sampleAdmin = User.builder().userId(99).username("moderator").role(Role.builder().roleName("ADMIN").build()).build();
    }

    private void authenticateAdministrator() {
        when(userRepository.findByNormalizedUsernameOrEmail("moderator")).thenReturn(Optional.of(sampleAdmin));
    }

    @Test
    @DisplayName("Lấy danh sách nội dung chờ duyệt bao gồm under_review và pending cùng thông tin AI")
    void getPendingContents_returnsUnderReviewItems() {
        when(contentRepository.findByStatusIn(eq(List.of("under_review", "pending")), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(underReviewContent)));
        when(contentModerationRepository.findByContentIdIn(eq(List.of(10))))
                .thenReturn(List.of(sampleModeration));

        PagedResponse<AdminContentResponse> result = adminModerationService.getPendingContents(null, 0, 10);

        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        AdminContentResponse item = result.getContent().get(0);
        assertEquals(10, item.getContentId());
        assertEquals("BLOG", item.getContentType());
        assertEquals("under_review", item.getStatus());
        assertEquals("truong_author", item.getAuthorUsername());
        assertEquals("https://example.com/thumb.jpg", item.getThumbnailUrl());
        assertEquals("Rau củ tươi ngon", item.getBody());
        assertTrue(item.getAiFlagged());
        assertEquals("Phát hiện nguyên liệu cần kiểm tra thủ công", item.getAiReason());
        assertEquals(0.85, item.getAiConfidence());
    }

    @Test
    @DisplayName("Lọc danh sách chờ duyệt theo contentType")
    void getPendingContents_filteredByType() {
        when(contentRepository.findByStatusInAndContentType(eq(List.of("under_review", "pending")), eq("BLOG"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(underReviewContent)));
        when(contentModerationRepository.findByContentIdIn(eq(List.of(10))))
                .thenReturn(List.of(sampleModeration));

        PagedResponse<AdminContentResponse> result = adminModerationService.getPendingContents("BLOG", 0, 10);

        assertNotNull(result);
        assertEquals(1, result.getContent().size());
    }

    @Test
    @DisplayName("Hàng đợi kiểm duyệt sắp xếp bài đăng trước lên trước (FIFO)")
    void getPendingContents_sortsByOldestSubmissionFirst() {
        when(contentRepository.findByStatusIn(eq(List.of("under_review", "pending")), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(underReviewContent)));
        when(contentModerationRepository.findByContentIdIn(eq(List.of(10))))
                .thenReturn(List.of(sampleModeration));

        adminModerationService.getPendingContents(null, 0, 10);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(contentRepository).findByStatusIn(eq(List.of("under_review", "pending")), pageableCaptor.capture());
        Sort sort = pageableCaptor.getValue().getSort();
        assertNotNull(sort.getOrderFor("createdAt"));
        assertEquals(Sort.Direction.ASC, sort.getOrderFor("createdAt").getDirection());
        assertNotNull(sort.getOrderFor("contentId"));
        assertEquals(Sort.Direction.ASC, sort.getOrderFor("contentId").getDirection());
    }

    @Test
    @DisplayName("Admin duyệt bài (APPROVE) -> chuyển sang published")
    void moderateContent_approve() {
        authenticateAdministrator();
        when(contentRepository.findById(10)).thenReturn(Optional.of(underReviewContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(i -> i.getArgument(0));

        AdminModerationRequest request = new AdminModerationRequest();
        request.setAction("APPROVE");

        AdminContentResponse response = adminModerationService.moderateContent(10, request, "moderator");

        assertEquals("published", response.getStatus());
        assertEquals("published", underReviewContent.getStatus());
        ArgumentCaptor<ModerationDecisionAudit> audit = ArgumentCaptor.forClass(ModerationDecisionAudit.class);
        verify(moderationDecisionAuditRepository).save(audit.capture());
        assertEquals("APPROVE", audit.getValue().getAction());
        assertNull(audit.getValue().getAdminReason());
    }

    @Test
    @DisplayName("Admin duyệt kèm lý do lưu latest decision và audit snapshot")
    void moderateContent_approveWithReason_persistsReasonAndAudit() {
        authenticateAdministrator();
        when(contentRepository.findById(10)).thenReturn(Optional.of(underReviewContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(i -> i.getArgument(0));
        when(contentModerationRepository.findByContentId(10)).thenReturn(Optional.of(sampleModeration));
        when(contentModerationRepository.save(any(ContentModeration.class))).thenAnswer(i -> i.getArgument(0));
        AdminModerationRequest request = new AdminModerationRequest("APPROVE", "  Meets editorial policy  ");

        adminModerationService.moderateContent(10, request, "moderator");

        assertEquals("Meets editorial policy", sampleModeration.getDecisionReason());
        assertEquals(99, sampleModeration.getReviewedBy());
        ArgumentCaptor<ModerationDecisionAudit> audit = ArgumentCaptor.forClass(ModerationDecisionAudit.class);
        verify(moderationDecisionAuditRepository).save(audit.capture());
        assertEquals("Meets editorial policy", audit.getValue().getAdminReason());
        assertEquals("under_review", audit.getValue().getPreviousStatus());
        assertEquals("published", audit.getValue().getNewStatus());
    }

    @Test
    @DisplayName("Hai quyết định trên cùng nội dung lưu hai audit event riêng biệt")
    void moderateContent_multipleDecisions_preservesAuditHistory() {
        authenticateAdministrator();
        when(contentRepository.findById(10)).thenReturn(Optional.of(underReviewContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(i -> i.getArgument(0));
        when(contentModerationRepository.findByContentId(10)).thenReturn(Optional.of(sampleModeration));
        when(contentModerationRepository.save(any(ContentModeration.class))).thenAnswer(i -> i.getArgument(0));

        adminModerationService.moderateContent(10, new AdminModerationRequest("APPROVE", "Approved after review"), "moderator");
        underReviewContent.setStatus("pending");
        sampleModeration.setStatus("pending");
        adminModerationService.moderateContent(10, new AdminModerationRequest("REJECT", "New evidence requires rejection"), "moderator");

        ArgumentCaptor<ModerationDecisionAudit> audits = ArgumentCaptor.forClass(ModerationDecisionAudit.class);
        verify(moderationDecisionAuditRepository, times(2)).save(audits.capture());
        assertEquals("APPROVE", audits.getAllValues().get(0).getAction());
        assertEquals("REJECT", audits.getAllValues().get(1).getAction());
        assertEquals("pending", audits.getAllValues().get(1).getPreviousStatus());
        assertEquals("rejected", audits.getAllValues().get(1).getNewStatus());
    }

    @Test
    @DisplayName("Lỗi ghi audit được lan truyền từ phương thức giao dịch")
    void moderateContent_auditFailurePropagatesToTransactionalBoundary() throws NoSuchMethodException {
        authenticateAdministrator();
        when(contentRepository.findById(10)).thenReturn(Optional.of(underReviewContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(i -> i.getArgument(0));
        when(moderationDecisionAuditRepository.save(any(ModerationDecisionAudit.class))).thenThrow(new IllegalStateException("audit persistence failed"));

        assertTrue(AdminModerationService.class
                .getMethod("moderateContent", Integer.class, AdminModerationRequest.class, String.class)
                .isAnnotationPresent(Transactional.class));
        assertThrows(IllegalStateException.class, () -> adminModerationService.moderateContent(10, new AdminModerationRequest("APPROVE", null), "moderator"));
    }

    @Test
    @DisplayName("Từ chối thiếu hoặc chỉ có khoảng trắng bị chặn trước khi ghi dữ liệu")
    void moderateContent_rejectWithoutMeaningfulReason_isRejected() {
        when(contentRepository.findById(10)).thenReturn(Optional.of(underReviewContent));
        for (String reason : List.of("", "   ")) {
            AdminModerationRequest request = new AdminModerationRequest("REJECT", reason);
            assertThrows(BadRequestException.class, () -> adminModerationService.moderateContent(10, request, "moderator"));
        }
        verify(contentRepository, never()).save(any());
        verifyNoInteractions(moderationDecisionAuditRepository);
    }

    @Test
    @DisplayName("Danh tính không phải quản trị viên không thể quyết định kiểm duyệt")
    void moderateContent_nonAdminPrincipal_isRejected() {
        when(contentRepository.findById(10)).thenReturn(Optional.of(underReviewContent));
        User ordinaryUser = User.builder().userId(7).username("member").role(Role.builder().roleName("USER").build()).build();
        when(userRepository.findByNormalizedUsernameOrEmail("member")).thenReturn(Optional.of(ordinaryUser));
        assertThrows(BadRequestException.class, () -> adminModerationService.moderateContent(10, new AdminModerationRequest("APPROVE", null), "member"));
        verifyNoInteractions(moderationDecisionAuditRepository);
    }

    @Test
    @DisplayName("Admin từ chối bài (REJECT) lần đầu -> tăng strikeCount lên 1, chuyển trạng thái sang WARN, gửi cảnh báo")
    void moderateContent_reject() {
        authenticateAdministrator();
        when(contentRepository.findById(10)).thenReturn(Optional.of(underReviewContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(i -> i.getArgument(0));

        AdminModerationRequest request = new AdminModerationRequest();
        request.setAction("REJECT");
        request.setReason("Nội dung spam quảng cáo");

        AdminContentResponse response = adminModerationService.moderateContent(10, request, "moderator");

        assertEquals("rejected", response.getStatus());
        assertEquals("rejected", underReviewContent.getStatus());
        assertEquals(1, sampleAuthor.getStrikeCount());
        assertEquals(AccountStatus.WARN, sampleAuthor.getStatus());
        verify(userRepository).save(sampleAuthor);
        verify(userNotificationSender).sendWarningNotification(
                eq("truong@example.com"),
                eq("truong_author"),
                eq(1),
                eq("Nội dung spam quảng cáo")
        );
        verify(notificationService).createForContentModerationRejected(
                eq(1),
                eq(10),
                eq("Salad thanh đạm"),
                eq(1),
                eq("Nội dung spam quảng cáo")
        );
    }

    @Test
    @DisplayName("Admin từ chối bài (REJECT) khi đã có 2 gậy -> đạt 3 gậy, tự động khóa tài khoản BANNED và gửi email ban")
    void moderateContent_reject_thirdStrike_bansUser() {
        authenticateAdministrator();
        sampleAuthor.setStrikeCount(2);
        sampleAuthor.setStatus(AccountStatus.WARN);

        when(contentRepository.findById(10)).thenReturn(Optional.of(underReviewContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(i -> i.getArgument(0));

        AdminModerationRequest request = new AdminModerationRequest();
        request.setAction("REJECT");
        request.setReason("Tiếp tục đăng bài vi phạm nghiêm trọng");

        AdminContentResponse response = adminModerationService.moderateContent(10, request, "moderator");

        assertEquals("rejected", response.getStatus());
        assertEquals(3, sampleAuthor.getStrikeCount());
        assertEquals(AccountStatus.BANNED, sampleAuthor.getStatus());
        verify(userRepository).save(sampleAuthor);
        ArgumentCaptor<Object> suspensionEventCaptor = ArgumentCaptor.forClass(Object.class);
        verify(eventPublisher).publishEvent(suspensionEventCaptor.capture());
        assertInstanceOf(AccountSuspendedEvent.class, suspensionEventCaptor.getValue());
        AccountSuspendedEvent suspension = (AccountSuspendedEvent) suspensionEventCaptor.getValue();
        assertEquals(1, suspension.userId());
        assertTrue(suspension.strikeBased());
        assertEquals("Tiếp tục đăng bài vi phạm nghiêm trọng", suspension.reason());
        ArgumentCaptor<UserModerationAction> historyCaptor = ArgumentCaptor.forClass(UserModerationAction.class);
        verify(userModerationActionRepository).save(historyCaptor.capture());
        UserModerationAction history = historyCaptor.getValue();
        assertEquals("BAN", history.getAction());
        assertEquals("AUTOMATIC", history.getSource());
        assertEquals("WARN", history.getPreviousStatus());
        assertEquals("BANNED", history.getNewStatus());
        assertEquals("Tiếp tục đăng bài vi phạm nghiêm trọng", history.getReason());
        verify(notificationService).createForContentModerationRejected(
                eq(1),
                eq(10),
                eq("Salad thanh đạm"),
                eq(3),
                eq("Tiếp tục đăng bài vi phạm nghiêm trọng")
        );
    }

    @Test
    @DisplayName("Admin từ chối bài nhưng tác giả là ROLE_ADMIN -> không phạt gậy")
    void moderateContent_reject_adminAuthor_doesNotIncrementStrike() {
        authenticateAdministrator();
        Role adminRole = Role.builder().roleId(1).roleName("ADMIN").build();
        sampleAuthor.setRole(adminRole);

        when(contentRepository.findById(10)).thenReturn(Optional.of(underReviewContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(i -> i.getArgument(0));

        AdminModerationRequest request = new AdminModerationRequest();
        request.setAction("REJECT");
        request.setReason("Content does not meet publication policy");

        adminModerationService.moderateContent(10, request, "moderator");

        assertEquals(0, sampleAuthor.getStrikeCount());
        verify(userRepository, never()).save(any());
        verifyNoInteractions(userNotificationSender);
    }

    @Test
    @DisplayName("Admin ẩn bài (HIDE) -> chuyển sang archived")
    void moderateContent_hide() {
        when(contentRepository.findById(10)).thenReturn(Optional.of(underReviewContent));
        when(contentRepository.save(any(Content.class))).thenAnswer(i -> i.getArgument(0));

        AdminModerationRequest request = new AdminModerationRequest();
        request.setAction("HIDE");

        AdminContentResponse response = adminModerationService.moderateContent(10, request, "moderator");

        assertEquals("archived", response.getStatus());
        assertEquals("archived", underReviewContent.getStatus());
    }

    @Test
    @DisplayName("Action không hợp lệ -> ném BadRequestException")
    void moderateContent_invalidAction_throwsBadRequest() {
        when(contentRepository.findById(10)).thenReturn(Optional.of(underReviewContent));

        AdminModerationRequest request = new AdminModerationRequest();
        request.setAction("INVALID_ACTION");

        assertThrows(BadRequestException.class, () -> adminModerationService.moderateContent(10, request, "moderator"));
    }

    @Test
    @DisplayName("Không tìm thấy content -> ném NotFoundException")
    void moderateContent_notFound_throwsNotFound() {
        when(contentRepository.findById(999)).thenReturn(Optional.empty());

        AdminModerationRequest request = new AdminModerationRequest();
        request.setAction("APPROVE");

        assertThrows(NotFoundException.class, () -> adminModerationService.moderateContent(999, request, "moderator"));
    }
}
