package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.AdminModerationRequest;
import com.fpt.swp391.nutribot.dto.response.*;
import com.fpt.swp391.nutribot.entity.*;
import com.fpt.swp391.nutribot.event.ContentPublishedEvent;
import com.fpt.swp391.nutribot.event.AdminContentApprovedEvent;
import com.fpt.swp391.nutribot.event.AccountSuspendedEvent;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j @Service @RequiredArgsConstructor
public class AdminModerationService {
    private final ContentRepository contentRepository;
    private final ContentModerationRepository contentModerationRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final UserRepository userRepository;
    private final UserNotificationSender userNotificationSender;
    private final NotificationService notificationService;
    private final ModerationDecisionAuditRepository moderationDecisionAuditRepository;
    private final UserModerationActionRepository userModerationActionRepository;

    @Transactional(readOnly = true)
    public PagedResponse<AdminContentResponse> getPendingContents(String contentType, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("contentId")));
        List<String> statuses = List.of("under_review", "pending");
        Page<Content> results = contentType != null && !contentType.isBlank() ? contentRepository.findByStatusInAndContentType(statuses, contentType, pageable) : contentRepository.findByStatusIn(statuses, pageable);
        Map<Integer, ContentModeration> moderationByContent = contentModerationRepository.findByContentIdIn(results.getContent().stream().map(Content::getContentId).toList()).stream().collect(Collectors.toMap(ContentModeration::getContentId, Function.identity(), (a, b) -> a));
        return PagedResponse.of(results.map(content -> toResponse(content, moderationByContent.get(content.getContentId()))));
    }

    @Transactional
    public AdminContentResponse moderateContent(Integer contentId, AdminModerationRequest request, String adminUsername) {
        Content content = contentRepository.findByIdForUpdate(contentId).or(() -> contentRepository.findById(contentId)).orElseThrow(() -> new NotFoundException("Content not found: " + contentId));
        String action = request.getAction().toUpperCase(Locale.ROOT);
        boolean decision = "APPROVE".equals(action) || "REJECT".equals(action);
        if (!decision && !"HIDE".equals(action)) throw new BadRequestException("Invalid moderation action");
        if (decision && !List.of("under_review", "pending").contains(content.getStatus())) throw new BadRequestException("Content is no longer awaiting review");
        String reason = blank(request.getReason());
        if ("REJECT".equals(action) && reason == null) throw new BadRequestException("A rejection reason is required");
        if (reason != null && reason.length() > 1000) throw new BadRequestException("Reason must not exceed 1000 characters");
        User admin = decision ? resolveAdmin(adminUsername) : null;
        String previous = content.getStatus();
        ContentModeration moderation = contentModerationRepository.findByContentId(contentId)
                .orElseGet(() -> ContentModeration.builder().contentId(contentId).status("pending").build());
        if ("APPROVE".equals(action)) content.setStatus("published");
        else if ("REJECT".equals(action)) { content.setStatus("rejected"); reject(content, request.getReason()); }
        else content.setStatus("archived");
        Content saved = contentRepository.save(content);
        if (decision) {
            moderation.setStatus("APPROVE".equals(action) ? "approved" : "rejected");
            moderation.setReviewedBy(admin.getUserId());
            moderation.setReviewedAt(LocalDateTime.now());
            moderation.setAdminNote(reason);
            moderation.setDecisionReason(reason);
            moderation = contentModerationRepository.save(moderation);
        } else if ("HIDE".equals(action)) {
            moderation.setStatus("rejected");
            moderation.setReviewedAt(LocalDateTime.now());
            moderation = contentModerationRepository.save(moderation);
        }
        if (decision) moderationDecisionAuditRepository.save(snapshot(content, moderation, admin, action, previous, reason));
        if ("APPROVE".equals(action)) {
            eventPublisher.publishEvent(new ContentPublishedEvent(contentId));
            eventPublisher.publishEvent(new AdminContentApprovedEvent(contentId));
        }
        return toResponse(saved, moderation);
    }

    @Transactional
    public AdminContentResponse moderateContent(Integer contentId, AdminModerationRequest request) {
        return moderateContent(contentId, request, null);
    }

    private User resolveAdmin(String principalName) {
        if (principalName == null || principalName.isBlank()) throw new BadRequestException("Authenticated administrator is required");
        User admin = userRepository.findByNormalizedUsernameOrEmail(principalName)
                .orElseThrow(() -> new NotFoundException("Authenticated administrator was not found"));
        if (!isAdmin(admin)) throw new BadRequestException("Authenticated user is not an administrator");
        return admin;
    }

    @Transactional(readOnly = true)
    public PagedResponse<ModerationAuditResponse> getHistory(String query, String action, String contentType, String admin, LocalDate from, LocalDate to, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100), Sort.by(Sort.Order.desc("decidedAt"), Sort.Order.desc("auditId")));
        return PagedResponse.of(moderationDecisionAuditRepository.search(blank(query), blank(action), blank(contentType), blank(admin), from == null ? null : from.atStartOfDay(), to == null ? null : to.plusDays(1).atStartOfDay(), pageable).map(this::auditResponse));
    }
    @Transactional(readOnly = true) public ModerationAuditResponse getHistoryDetail(Long id) { return auditResponse(moderationDecisionAuditRepository.findById(id).orElseThrow(() -> new NotFoundException("Moderation audit not found"))); }
    @Transactional(readOnly = true) public List<ModerationAuditResponse> getTimeline(Integer contentId) { return moderationDecisionAuditRepository.findByContentIdOrderByDecidedAtAscAuditIdAsc(contentId).stream().map(this::auditResponse).toList(); }

    private ModerationDecisionAudit snapshot(Content c, ContentModeration m, User admin, String action, String previous, String reason) {
        return ModerationDecisionAudit.builder().contentId(c.getContentId()).contentType(c.getContentType()).contentTitle(c.getTitle()).authorId(c.getUser() == null ? null : c.getUser().getUserId()).authorUsername(c.getUser() == null ? null : c.getUser().getUsername()).previousStatus(previous).newStatus(c.getStatus()).action(action).adminId(admin.getUserId()).adminUsername(admin.getUsername()).adminReason(blank(reason)).aiFlagged(m == null ? null : m.getAiFlagged()).aiReason(m == null ? null : m.getAiReason()).aiConfidence(m == null ? null : m.getAiConfidence()).contentBodySnapshot(c.getBody()).thumbnailUrlSnapshot(c.getThumbnailUrl()).mediaUrlSnapshot(c.getMediaUrl()).build();
    }
    private ModerationAuditResponse auditResponse(ModerationDecisionAudit a) { return ModerationAuditResponse.builder().auditId(a.getAuditId()).contentId(a.getContentId()).contentType(a.getContentType()).contentTitle(a.getContentTitle()).authorUsername(a.getAuthorUsername()).action(a.getAction()).previousStatus(a.getPreviousStatus()).newStatus(a.getNewStatus()).adminId(a.getAdminId()).adminUsername(a.getAdminUsername()).adminReason(a.getAdminReason()).decidedAt(a.getDecidedAt()).aiFlagged(a.getAiFlagged()).aiReason(a.getAiReason()).aiConfidence(a.getAiConfidence() == null ? null : a.getAiConfidence().doubleValue()).contentBodySnapshot(a.getContentBodySnapshot()).thumbnailUrlSnapshot(a.getThumbnailUrlSnapshot()).mediaUrlSnapshot(a.getMediaUrlSnapshot()).build(); }
    private String blank(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private void reject(Content content, String reason) {
        User author = content.getUser(); if (author == null || isAdmin(author)) return;
        int strikes = (author.getStrikeCount() == null ? 0 : author.getStrikeCount()) + 1; author.setStrikeCount(strikes);
        boolean becameBanned = author.getStatus() != AccountStatus.BANNED && strikes >= 3;
        if (strikes >= 3) author.setStatus(AccountStatus.BANNED); else if (author.getStatus() == AccountStatus.ACTIVE) author.setStatus(AccountStatus.WARN);
        userRepository.save(author); String detail = blank(reason) == null ? "Content violates community standards" : reason.trim();
        try { if (author.getEmail() != null && !author.getEmail().isBlank() && strikes < 3) userNotificationSender.sendWarningNotification(author.getEmail(), author.getUsername(), strikes, detail); } catch (Exception e) { log.error("Could not send moderation email", e); }
        if (becameBanned) {
            if (userModerationActionRepository != null) userModerationActionRepository.save(UserModerationAction.builder().userId(author.getUserId()).action("BAN").source("AUTOMATIC").previousStatus(AccountStatus.WARN.name()).newStatus(AccountStatus.BANNED.name()).reason(detail).additionalExplanation(detail).strikeDelta((short) 1).build());
            eventPublisher.publishEvent(new AccountSuspendedEvent(author.getUserId(), true, detail));
            log.info("Account suspension event published: userId={}, type=STRIKE", author.getUserId());
        }
        try { notificationService.createForContentModerationRejected(author.getUserId(), content.getContentId(), content.getTitle(), strikes, detail); } catch (Exception e) { log.error("Could not create moderation notification", e); }
    }
    private boolean isAdmin(User user) { return user.getRole() != null && user.getRole().getRoleName() != null && (user.getRole().getRoleName().equalsIgnoreCase("ADMIN") || user.getRole().getRoleName().equalsIgnoreCase("ROLE_ADMIN")); }
    private AdminContentResponse toResponse(Content c, ContentModeration m) {
        Content matched = (c.getMatchedContentId() != null)
                ? contentRepository.findById(c.getMatchedContentId()).orElse(null)
                : null;
        String matchedAuthor = null;
        if (matched != null && matched.getUser() != null) {
            matchedAuthor = (matched.getUser().getFullName() != null && !matched.getUser().getFullName().isBlank())
                    ? matched.getUser().getFullName()
                    : matched.getUser().getUsername();
        }

        return AdminContentResponse.builder()
                .contentId(c.getContentId())
                .contentType(c.getContentType())
                .title(c.getTitle())
                .slug(c.getSlug())
                .status(c.getStatus())
                .body(c.getBody())
                .thumbnailUrl(c.getThumbnailUrl())
                .mediaUrl(c.getMediaUrl())
                .authorUsername(c.getUser() == null ? null : c.getUser().getUsername())
                .authorEmail(c.getUser() == null ? null : c.getUser().getEmail())
                .viewCount(c.getViewCount())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .aiFlagged(m == null ? null : m.getAiFlagged())
                .aiReason(m == null ? null : m.getAiReason())
                .aiConfidence(m == null || m.getAiConfidence() == null ? null : m.getAiConfidence().doubleValue())
                .decisionReason(m == null ? null : m.getDecisionReason())
                .moderationFlag(c.getModerationFlag())
                .similarityScore(c.getSimilarityScore())
                .matchedContentId(c.getMatchedContentId())
                .matchedTitle(matched == null ? null : matched.getTitle())
                .matchedAuthor(matchedAuthor)
                .matchedBody(matched == null ? null : matched.getBody())
                .matchedPublishedAt(matched == null ? null : matched.getCreatedAt())
                .build();
    }
}
