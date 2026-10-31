package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.NotificationResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.ForbiddenException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<NotificationResponse>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication authentication) {
        Integer userId = getUserId(authentication);
        PagedResponse<NotificationResponse> result = notificationService.listMyNotifications(userId, page, size);
        return ResponseEntity.ok(ApiResponse.success("Lấy danh sách thông báo thành công", result));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Long>> unreadCount(Authentication authentication) {
        Integer userId = getUserId(authentication);
        long count = notificationService.getUnreadCount(userId);
        return ResponseEntity.ok(ApiResponse.success("Lấy số thông báo chưa đọc thành công", count));
    }

    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<ApiResponse<Void>> markRead(@PathVariable Integer notificationId, Authentication authentication) {
        Integer userId = getUserId(authentication);
        notificationService.markAsRead(userId, notificationId);
        return ResponseEntity.ok(ApiResponse.success("Đánh dấu đã đọc thành công", null));
    }

    @PatchMapping("/read-all")
    public ResponseEntity<ApiResponse<Void>> markAllRead(Authentication authentication) {
        Integer userId = getUserId(authentication);
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok(ApiResponse.success("Đánh dấu tất cả đã đọc thành công", null));
    }

    private Integer getUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getPrincipal())) {
            throw new NotFoundException("Không tìm thấy thông tin người dùng");
        }
        String username = authentication.getName();
        User user = userRepository.findByUsernameIgnoreCase(username).orElse(null);
        if (user == null) {
            user = userRepository.findByEmailIgnoreCase(username).orElse(null);
        }
        if (user == null) {
            throw new NotFoundException("Không tìm thấy thông tin người dùng");
        }
        if (!AccountStatus.canAccessSystem(user.getStatus())) {
            throw new ForbiddenException("Tài khoản không đủ điều kiện sử dụng thông báo");
        }
        return user.getUserId();
    }
}
