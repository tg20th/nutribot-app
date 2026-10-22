package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.AuthorRecipeSuggestionResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.dto.response.RecipeSuggestionAuditResponse;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestion;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestionAudit;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.ContentRecipeSuggestionAuditRepository;
import com.fpt.swp391.nutribot.repository.ContentRecipeSuggestionRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử vòng đời duyệt công thức cho tác giả (NB-84)")
class RecipeSuggestionApprovalFlowTest {

    @Mock
    private ContentRecipeSuggestionRepository suggestionRepository;
    @Mock
    private ContentRecipeSuggestionAuditRepository auditRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationService notificationService;

    private AuthorRecipeSuggestionService authorService;
    private RecipeSuggestionAuditService auditService;
    private RecipeConsentRevocationService revocationService;

    private static final LocalDateTime BASE_TIME = LocalDateTime.of(2026, 10, 22, 9, 0, 0);

    @BeforeEach
    void setUp() {
        auditService = new RecipeSuggestionAuditService(auditRepository, userRepository);
        authorService = new AuthorRecipeSuggestionService(suggestionRepository, userRepository);
        revocationService = new RecipeConsentRevocationService(suggestionRepository, auditService, notificationService);
    }

    private User author() {
        return User.builder().userId(9).username("author").fullName("Tác giả").build();
    }

    private User admin() {
        return User.builder().userId(1).username("admin").fullName("Quản trị viên").build();
    }

    private Content content() {
        return Content.builder()
                .contentId(82)
                .user(author())
                .contentType("BLOG")
                .title("Chia sẻ cách làm Phở nấm thuần chay")
                .status("published")
                .build();
    }

    private ContentRecipeSuggestion suggestion(String status) {
        return ContentRecipeSuggestion.builder()
                .suggestionId(700)
                .content(content())
                .status(status)
                .dishName("Phở nấm thuần chay")
                .recipeTitle("Phở nấm thuần chay")
                .sourceViewCount(1800)
                .sourceVoteCount(120)
                .createdAt(BASE_TIME)
                .updatedAt(BASE_TIME)
                .build();
    }

    @Test
    @DisplayName("NB-84: Tác giả xem được đề xuất của chính mình kèm trạng thái và lý do từ chối")
    void listMySuggestions_returnsOwnSuggestions() {
        ContentRecipeSuggestion rejected = suggestion("REJECTED");
        rejected.setRejectionReason("Trùng món đã có trong hệ thống");
        rejected.setReviewedBy(1);
        rejected.setReviewedAt(BASE_TIME.plusMinutes(5));

        when(userRepository.findByUsername("author")).thenReturn(Optional.of(author()));
        when(suggestionRepository.findByContentUserUserId(eq(9), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(rejected)));
        when(userRepository.findAllById(anyCollection())).thenReturn(List.of(admin()));

        PagedResponse<AuthorRecipeSuggestionResponse> result =
                authorService.listMySuggestions("author", null, 0, 10);

        assertEquals(1, result.getContent().size());
        AuthorRecipeSuggestionResponse item = result.getContent().get(0);
        assertEquals(700, item.getSuggestionId());
        assertEquals("REJECTED", item.getStatus());
        assertEquals("Phở nấm thuần chay", item.getDishName());
        assertEquals(82, item.getContentId());
        assertEquals("Chia sẻ cách làm Phở nấm thuần chay", item.getContentTitle());
        assertEquals("BLOG", item.getContentType());
        assertEquals("Trùng món đã có trong hệ thống", item.getRejectionReason());
        assertEquals("Quản trị viên", item.getReviewedByName());
    }

    @Test
    @DisplayName("NB-84: Lọc danh sách đề xuất theo trạng thái")
    void listMySuggestions_filtersByStatus() {
        when(userRepository.findByUsername("author")).thenReturn(Optional.of(author()));
        when(suggestionRepository.findByContentUserUserIdAndStatusIn(eq(9), eq(List.of("PENDING")), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(suggestion("PENDING"))));

        PagedResponse<AuthorRecipeSuggestionResponse> result =
                authorService.listMySuggestions("author", "pending", 0, 10);

        assertEquals(1, result.getContent().size());
        verify(suggestionRepository).findByContentUserUserIdAndStatusIn(eq(9), eq(List.of("PENDING")), any(Pageable.class));
    }

    @Test
    @DisplayName("NB-84: Không xem được đề xuất của người khác")
    void getMySuggestion_otherOwner_notFound() {
        when(userRepository.findByUsername("author")).thenReturn(Optional.of(author()));
        when(suggestionRepository.findBySuggestionIdAndContentUserUserId(700, 9)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> authorService.getMySuggestion("author", 700));
    }

    @Test
    @DisplayName("NB-84: Tác giả rút đồng thuận thì đề xuất PENDING chuyển sang REJECTED kèm lý do")
    void revokePendingSuggestions_rejectsPendingSuggestion() {
        ContentRecipeSuggestion pending = suggestion("PENDING");
        when(suggestionRepository.findByContentContentIdAndStatusIn(82, List.of("PENDING")))
                .thenReturn(List.of(pending));

        int changed = revocationService.revokePendingSuggestions(82, 9);

        assertEquals(1, changed);
        assertEquals("REJECTED", pending.getStatus());
        assertEquals(RecipeConsentRevocationService.REASON_CONSENT_REVOKED, pending.getRejectionReason());
        assertEquals(9, pending.getReviewedBy());
        assertNotNull(pending.getReviewedAt());
        verify(suggestionRepository).save(pending);
        verify(auditRepository).save(any(ContentRecipeSuggestionAudit.class));
    }

    @Test
    @DisplayName("NB-84: Rút đồng thuận ghi audit AUTO_REJECTED kèm lý do")
    void revokePendingSuggestions_writesAudit() {
        ContentRecipeSuggestion pending = suggestion("PENDING");
        when(suggestionRepository.findByContentContentIdAndStatusIn(82, List.of("PENDING")))
                .thenReturn(List.of(pending));

        revocationService.revokePendingSuggestions(82, 9);

        ArgumentCaptor<ContentRecipeSuggestionAudit> captor =
                ArgumentCaptor.forClass(ContentRecipeSuggestionAudit.class);
        verify(auditRepository).save(captor.capture());
        ContentRecipeSuggestionAudit audit = captor.getValue();
        assertEquals(ContentRecipeSuggestionAudit.ACTION_AUTO_REJECTED, audit.getAction());
        assertEquals(9, audit.getActorId());
        assertEquals(RecipeConsentRevocationService.REASON_CONSENT_REVOKED, audit.getReason());
        assertEquals(700, audit.getSuggestion().getSuggestionId());
    }

    @Test
    @DisplayName("NB-84: Đề xuất đã xử lý thì không bị đóng lại khi rút đồng thuận")
    void revokePendingSuggestions_skipsNonPending() {
        ContentRecipeSuggestion approved = suggestion("APPROVED");
        when(suggestionRepository.findByContentContentIdAndStatusIn(82, List.of("PENDING")))
                .thenReturn(List.of(approved));

        int changed = revocationService.revokePendingSuggestions(82, 9);

        assertEquals(0, changed);
        assertEquals("APPROVED", approved.getStatus());
        verify(suggestionRepository, never()).save(any());
        verify(auditRepository, never()).save(any());
        verify(notificationService, never()).createForRecipeSuggestionClosed(any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("NB-84: Rút đồng thuận thì tác giả nhận thông báo đề xuất đã đóng")
    void revokePendingSuggestions_notifiesAuthor() {
        ContentRecipeSuggestion pending = suggestion("PENDING");
        when(suggestionRepository.findByContentContentIdAndStatusIn(82, List.of("PENDING")))
                .thenReturn(List.of(pending));

        revocationService.revokePendingSuggestions(82, 9);

        verify(notificationService).createForRecipeSuggestionClosed(
                eq(9),
                eq(700),
                eq(82),
                eq("Phở nấm thuần chay"),
                eq("Chia sẻ cách làm Phở nấm thuần chay"),
                eq(RecipeConsentRevocationService.REASON_CONSENT_REVOKED));
    }

    @Test
    @DisplayName("NB-84: Job quét đóng các đề xuất PENDING của bài không còn đồng thuận")
    void sweepClosesPendingWithoutConsent() {
        ContentRecipeSuggestion pending = suggestion("PENDING");
        when(suggestionRepository.findPendingWithoutConsent()).thenReturn(List.of(pending));

        int changed = revocationService.revokePendingSuggestionsWithoutConsent();

        assertEquals(1, changed);
        assertEquals("REJECTED", pending.getStatus());
        assertEquals(9, pending.getReviewedBy());
    }

    @Test
    @DisplayName("NB-84: Admin đọc được nhật ký đề xuất theo thứ tự thời gian")
    void listAudit_returnsEntriesWithActorName() {
        ContentRecipeSuggestionAudit audit = ContentRecipeSuggestionAudit.builder()
                .auditId(1)
                .suggestion(suggestion("PENDING"))
                .action(ContentRecipeSuggestionAudit.ACTION_APPROVED)
                .actorId(1)
                .reason("Duyệt thủ công")
                .createdAt(BASE_TIME)
                .build();
        when(auditRepository.findBySuggestionSuggestionIdOrderByCreatedAtDesc(700)).thenReturn(List.of(audit));
        when(userRepository.findAllById(anyCollection())).thenReturn(List.of(admin()));

        List<RecipeSuggestionAuditResponse> result = auditService.listBySuggestion(700);

        assertEquals(1, result.size());
        assertEquals(ContentRecipeSuggestionAudit.ACTION_APPROVED, result.get(0).getAction());
        assertEquals("Quản trị viên", result.get(0).getActorName());
        assertEquals("Duyệt thủ công", result.get(0).getReason());
        assertEquals(700, result.get(0).getSuggestionId());
    }

    @Test
    @DisplayName("NB-84: Đề xuất không có nhật ký trả về danh sách rỗng")
    void listAudit_empty() {
        when(auditRepository.findBySuggestionSuggestionIdOrderByCreatedAtDesc(700)).thenReturn(List.of());

        assertTrue(auditService.listBySuggestion(700).isEmpty());
    }

    /**
     * NB-84: Chống hồi quy deadlock.
     * Bảng audit có khoá ngoại tới đề xuất, nên ghi nhật ký PHẢI dùng chung transaction
     * với lệnh INSERT đề xuất. Nếu dùng REQUIRES_NEW thì transaction con phải chờ
     * transaction cha commit -> treo khoá vô hạn, đề xuất không bao giờ hiển thị.
     */
    @Test
    @DisplayName("NB-84: Ghi nhật ký phải dùng chung transaction với đề xuất (không REQUIRES_NEW)")
    void auditRecord_joinsCallerTransaction() throws NoSuchMethodException {
        Propagation propagation = RecipeSuggestionAuditService.class
                .getMethod("record", ContentRecipeSuggestion.class, String.class, Integer.class, String.class)
                .getAnnotation(Transactional.class)
                .propagation();

        assertEquals(Propagation.REQUIRED, propagation);
    }

    /**
     * NB-84: Mỗi nội dung được đánh giá trong transaction riêng để một lỗi (trùng ràng
     * buộc unique) không làm hỏng cả lượt quét của job định kỳ.
     */
    @Test
    @DisplayName("NB-84: Đánh giá nội dung chạy trong transaction riêng (REQUIRES_NEW)")
    void evaluateContent_runsInOwnTransaction() throws NoSuchMethodException {
        Propagation propagation = ContentRecipeSuggestionService.class
                .getMethod("evaluateContent", Content.class)
                .getAnnotation(Transactional.class)
                .propagation();

        assertEquals(Propagation.REQUIRES_NEW, propagation);
    }
}
