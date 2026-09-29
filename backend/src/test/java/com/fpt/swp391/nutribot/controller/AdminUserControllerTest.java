package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.AdminUserStatusRequest;
import com.fpt.swp391.nutribot.dto.response.AdminUserResponse;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.service.AdminUserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử AdminUserController - API Quản trị người dùng & Phân quyền (Task NB-36 / BL-003)")
class AdminUserControllerTest {

    @Mock
    private AdminUserService adminUserService;

    @Mock
    private Authentication authentication;

    @InjectMocks
    private AdminUserController adminUserController;

    @BeforeEach
    void setUp() {
    }

    @Test
    @DisplayName("GET /api/v1/admin/users -> Thành công trả về PagedResponse bọc ApiResponse")
    void getAllUsers_success_returnsPagedResponse() {
        PagedResponse<AdminUserResponse> pagedResponse = PagedResponse.<AdminUserResponse>builder()
                .content(Collections.emptyList())
                .page(0)
                .size(10)
                .totalElements(0L)
                .totalPages(0)
                .first(true)
                .last(true)
                .build();

        when(adminUserService.getAllUsers("minh", "ACTIVE", 0, 10)).thenReturn(pagedResponse);

        ResponseEntity<ApiResponse<PagedResponse<AdminUserResponse>>> response =
                adminUserController.getAllUsers("minh", "ACTIVE", 0, 10);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isTrue();
        assertThat(response.getBody().getData()).isEqualTo(pagedResponse);

        verify(adminUserService).getAllUsers("minh", "ACTIVE", 0, 10);
    }

    @Test
    @DisplayName("PUT /api/v1/admin/users/{userId}/status -> Trích xuất principal quản trị và gọi Service cập nhật")
    void updateUserStatus_success_callsServiceWithPrincipal() {
        AdminUserStatusRequest request = AdminUserStatusRequest.builder()
                .status("BANNED")
                .reason("Vi phạm chính sách nội dung")
                .build();

        AdminUserResponse responseDto = AdminUserResponse.builder()
                .userId(10)
                .username("minh_member")
                .status("BANNED")
                .build();

        when(authentication.getName()).thenReturn("admin_master");
        when(adminUserService.updateUserStatus(10, request, "admin_master")).thenReturn(responseDto);

        ResponseEntity<ApiResponse<AdminUserResponse>> response =
                adminUserController.updateUserStatus(10, request, authentication);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isTrue();
        assertThat(response.getBody().getData().getStatus()).isEqualTo("BANNED");

        verify(adminUserService).updateUserStatus(10, request, "admin_master");
    }
}
