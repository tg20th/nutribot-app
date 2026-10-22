package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestion;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestionAudit;
import com.fpt.swp391.nutribot.repository.ContentRecipeSuggestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * NB-84: Xu ly de xuat cong thuc khi tac gia rut dong thuan dung cong thuc.
 * <p>
 * Khi bai viet khong con duoc phep dung cong thuc, de xuat dang PENDING se khong
 * bao gio duoc duyet (co chot chan cuoi o {@code ContentRecipeSuggestionReviewService}).
 * De khong de de xuat bi ket vinh vien, cac de xuat dang PENDING se duoc chuyen sang
 * REJECTED kem ly do ro rang. Van nhan dung trang thai REJECTED da co san, khong
 * them trang thai moi.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecipeConsentRevocationService {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_REJECTED = "REJECTED";
    public static final String REASON_CONSENT_REVOKED =
            "Tác giả đã gỡ đồng thuận dùng công thức cho bài viết này";

    private final ContentRecipeSuggestionRepository suggestionRepository;
    private final RecipeSuggestionAuditService auditService;
    private final NotificationService notificationService;

    /**
     * Chuyen cac de xuat PENDING cua 1 bai viet sang REJECTED khi tac gia rut dong thuan.
     *
     * @return so de xuat da duoc chuyen trang thai.
     */
    @Transactional
    public int revokePendingSuggestions(Integer contentId, Integer actorId) {
        if (contentId == null) {
            return 0;
        }
        List<ContentRecipeSuggestion> pending =
                suggestionRepository.findByContentContentIdAndStatusIn(contentId, List.of(STATUS_PENDING));
        int changed = 0;
        for (ContentRecipeSuggestion suggestion : pending) {
            if (reject(suggestion, actorId)) {
                changed++;
            }
        }
        if (changed > 0) {
            log.info("Da chuyen {} de xuat cong thuc sang REJECTED vi tac gia rut dong thuan (content {})",
                    changed, contentId);
        }
        return changed;
    }

    /**
     * Quet toan bo de xuat PENDING ma bai viet da khong con dong thuan.
     * Dung cho job dinh ky de doi soat lai truong hop bai bi xoa hoac xu ly o noi khac.
     *
     * @return so de xuat da duoc chuyen trang thai.
     */
    @Transactional
    public int revokePendingSuggestionsWithoutConsent() {
        List<ContentRecipeSuggestion> pending = suggestionRepository.findPendingWithoutConsent();
        int changed = 0;
        for (ContentRecipeSuggestion suggestion : pending) {
            Integer authorId = suggestion.getContent() != null && suggestion.getContent().getUser() != null
                    ? suggestion.getContent().getUser().getUserId()
                    : null;
            if (reject(suggestion, authorId)) {
                changed++;
            }
        }
        if (changed > 0) {
            log.info("Job quet da chuyen {} de xuat cong thuc sang REJECTED vi khong con dong thuan", changed);
        }
        return changed;
    }

    private boolean reject(ContentRecipeSuggestion suggestion, Integer actorId) {
        if (suggestion == null || !STATUS_PENDING.equalsIgnoreCase(suggestion.getStatus())) {
            return false;
        }
        suggestion.setStatus(STATUS_REJECTED);
        suggestion.setRejectionReason(REASON_CONSENT_REVOKED);
        suggestion.setReviewedBy(actorId);
        suggestion.setReviewedAt(LocalDateTime.now());
        suggestionRepository.save(suggestion);
        auditService.record(suggestion, ContentRecipeSuggestionAudit.ACTION_AUTO_REJECTED, actorId, REASON_CONSENT_REVOKED);
        notifyAuthor(suggestion);
        return true;
    }

    /**
     * NB-84: Thong bao cho tac gia biet de xuat da duoc dong lai vi khong con dong thuan.
     */
    private void notifyAuthor(ContentRecipeSuggestion suggestion) {
        Content content = suggestion.getContent();
        if (content == null || content.getUser() == null) {
            return;
        }
        notificationService.createForRecipeSuggestionClosed(
                content.getUser().getUserId(),
                suggestion.getSuggestionId(),
                content.getContentId(),
                suggestion.getDishName(),
                content.getTitle(),
                REASON_CONSENT_REVOKED);
    }
}
