package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.RecipeSuggestionAuditResponse;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestion;
import com.fpt.swp391.nutribot.entity.ContentRecipeSuggestionAudit;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.repository.ContentRecipeSuggestionAuditRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * NB-84: Nhat ky append-only cho vong doi trang thai cua de xuat cong thuc.
 * Moi thay doi trang thai deu ghi lai ai lam gi va vi ly do de doi soat lai duong.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecipeSuggestionAuditService {

    private final ContentRecipeSuggestionAuditRepository auditRepository;
    private final UserRepository userRepository;

    /**
     * Ghi 1 dong nhat ky.
     * <p>
     * PHẢI dùng chung transaction với thao tác ghi đề xuất (propagation {@code REQUIRED}).
     * Bảng {@code content_recipe_suggestion_audit} có khoá ngoại
     * {@code fk_crsa_suggestion} trỏ tới {@code content_recipe_suggestions.suggestion_id},
     * nên nếu mở transaction riêng (REQUIRES_NEW) thì lệnh INSERT sẽ phải chờ
     * transaction cha commit hàng đề xuất -> DEADLOCK giữa hai connection của cùng app.
     * Ghi chung transaction cũng giữ được tính nguyên tử: có đề xuất thì mới có nhật ký.
     */
    @Transactional
    public void record(ContentRecipeSuggestion suggestion, String action, Integer actorId, String reason) {
        if (suggestion == null || suggestion.getSuggestionId() == null || action == null) {
            return;
        }
        auditRepository.save(ContentRecipeSuggestionAudit.builder()
                .suggestion(suggestion)
                .action(action)
                .actorId(actorId)
                .reason(reason)
                .build());
    }

    @Transactional(readOnly = true)
    public List<RecipeSuggestionAuditResponse> listBySuggestion(Integer suggestionId) {
        List<ContentRecipeSuggestionAudit> audits =
                auditRepository.findBySuggestionSuggestionIdOrderByCreatedAtDesc(suggestionId);
        if (audits.isEmpty()) {
            return List.of();
        }
        Map<Integer, String> actorNames = resolveActorNames(audits);
        return audits.stream()
                .map(audit -> toResponse(audit, actorNames))
                .toList();
    }

    private Map<Integer, String> resolveActorNames(List<ContentRecipeSuggestionAudit> audits) {
        List<Integer> actorIds = audits.stream()
                .map(ContentRecipeSuggestionAudit::getActorId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (actorIds.isEmpty()) {
            return Map.of();
        }
        Map<Integer, String> names = new HashMap<>();
        for (User user : userRepository.findAllById(actorIds)) {
            names.put(user.getUserId(), user.getFullName());
        }
        return names;
    }

    private RecipeSuggestionAuditResponse toResponse(
            ContentRecipeSuggestionAudit audit, Map<Integer, String> actorNames) {
        return RecipeSuggestionAuditResponse.builder()
                .auditId(audit.getAuditId())
                .suggestionId(audit.getSuggestion() != null ? audit.getSuggestion().getSuggestionId() : null)
                .action(audit.getAction())
                .actorId(audit.getActorId())
                .actorName(audit.getActorId() != null ? actorNames.get(audit.getActorId()) : null)
                .reason(audit.getReason())
                .createdAt(audit.getCreatedAt())
                .build();
    }
}
