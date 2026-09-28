package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.LoginRequest;
import com.fpt.swp391.nutribot.dto.request.RegisterRequest;
import com.fpt.swp391.nutribot.dto.request.VerifyOtpRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.AuthResponse;
import com.fpt.swp391.nutribot.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.ok(ApiResponse.success("Đăng ký tài khoản thành công. Vui lòng kiểm tra email để xác thực.", response));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<ApiResponse<AuthResponse>> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        AuthResponse response = authService.verifyRegister(request.getEmail(), request.getOtpCode());
        return ResponseEntity.ok(ApiResponse.success("Xác thực email thành công. Tài khoản đã được kích hoạt.", response));
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<ApiResponse<Void>> resendOtp(@RequestParam String email) {
        authService.resendOtp(email);
        return ResponseEntity.ok(ApiResponse.success("Đã gửi lại mã xác thực. Vui lòng kiểm tra hộp thư.", null));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success("Đăng nhập thành công", response));
    }
}
