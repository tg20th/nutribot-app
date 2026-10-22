package com.fpt.swp391.nutribot.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationResponse {

    private Integer notificationId;
    private String type;
    private String referenceType;
    private Integer referenceId;
    private Integer actorId;
    private String actorFullName;
    private String actorAvatarUrl;
    private boolean read;
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime readAt;
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    /**
     * NB-83: Tieu de bai viet duoc vote/comment (null voi thong bao duyet cong thuc cua NB-81).
     */
    private String contentTitle;

    /**
     * NB-83: Loai noi dung cua bai viet duoc vote/comment: BLOG hoac VIDEO
     * (null voi thong bao duyet cong thuc cua NB-81).
     */
    private String contentType;

    /**
     * NB-83: Thoi diem tuong tac gan nhat. Kiem duyet vote moi duoc gom vao thong bao cu
     * thi updated_at duoc cap nhat va thong bao do luon len dau danh sach.
     */
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime updatedAt;

    /**
     * NB-84: Tieu de rut gon cua thong bao. Vi du "Cong thuc da duoc them vao NutriBot".
     */
    private String title;

    /**
     * NB-84: Noi dung day du cua thong bao, gom ten cong thuc va ly do neu bi tu choi.
     */
    private String message;

    /**
     * NB-84: Duong dan dieu huong toi noi dung lien quan (VD: bai viet nguon).
     */
    private String actionUrl;
}
