package com.fpt.swp391.nutribot.event;

/**
 * Sự kiện phát ra sau khi một nội dung được Admin duyệt sang trạng thái published.
 * Dùng để kích hoạt đánh giá tạo ContentRecipeSuggestion (NB-60) bất đồng bộ,
 * không làm chậm API duyệt.
 */
public record ContentPublishedEvent(Integer contentId) {
}
