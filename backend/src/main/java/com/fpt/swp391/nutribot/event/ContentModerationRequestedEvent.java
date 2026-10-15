package com.fpt.swp391.nutribot.event;

/**
 * Sự kiện phát ra ngay khi tác giả nộp bài (POST submit). Listener bất đồng bộ
 * sẽ gọi AI moderation và cập nhật trạng thái cuối cùng (published hoặc giữ under_review).
 *
 * <p>Mục đích: giải phóng request HTTP khỏi việc chờ AI service (timeout 30s),
 * tránh vòng loading kéo dài trên UI khi tác giả bấm "Post".</p>
 *
 * @param contentId   ID của content vừa được nộp
 * @param contentType "BLOG" hoặc "VIDEO"
 * @param authorId    ID tác giả (dùng để log/notify)
 */
public record ContentModerationRequestedEvent(Integer contentId, String contentType, Integer authorId) {
}
