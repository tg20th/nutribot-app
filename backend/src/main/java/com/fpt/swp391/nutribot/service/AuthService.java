package com.fpt.swp391.nutribot.service;

import java.util.Optional;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fpt.swp391.nutribot.config.JwtTokenProvider;
import com.fpt.swp391.nutribot.dto.request.LoginRequest;
import com.fpt.swp391.nutribot.dto.request.RegisterRequest;
import com.fpt.swp391.nutribot.dto.response.AuthResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Role;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.AccountBannedException;
import com.fpt.swp391.nutribot.repository.RoleRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * =========================================================================================
 * 🛡️ MODULE 1: AUTHENTICATION & IDENTITY SERVICE (DÀNH CHO TRƯỜNG BE)
 * =========================================================================================
 * [Nhiệm vụ chính]:
 * - Đăng ký tài khoản mới kèm cơ chế gửi mã OTP xác thực email (2-step verification).
 * - Xác thực đăng nhập an toàn, cấp phát Access Token (JWT) có thời hạn sử dụng.
 * - Cơ chế đăng xuất bảo mật cao bằng Blacklist Token (BL-029).
 * - Tuân thủ nghiêm ngặt các quy tắc bảo mật: BL-003 (Chống Account Enumeration),
 *   BL-026 (Kiểm soát trạng thái tài khoản thời gian thực), BL-027 (Kiểm định khóa ký JWT).
 * =========================================================================================
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final OtpService otpService;

    // =====================================================================================
    // KHỐI 1: ĐĂNG KÝ TÀI KHOẢN (REGISTRATION & EMAIL OTP DISPATCH)
    // =====================================================================================
    /**
     * Đăng ký tài khoản người dùng mới.
     * [Business Rules]:
     * - Username và Email phải là duy nhất (kiểm tra sau khi chuẩn hóa trim và lowercase).
     * - Mật khẩu bắt buộc được mã hóa một chiều bằng thuật toán BCrypt trước khi lưu vào DB.
     * - Trạng thái ban đầu luôn là PENDING_VERIFY (chưa được phép đăng nhập ngay).
     * - Tự động tạo và gửi mã OTP 6 số qua email của người dùng.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByNormalizedUsername(request.getUsername())) {
            throw new BadRequestException("Username is already taken.");
        }

        if (userRepository.existsByNormalizedEmail(request.getEmail())) {
            throw new BadRequestException("Email is already registered.");
        }

        Role userRole = roleRepository.findByRoleName("ROLE_USER")
                .or(() -> roleRepository.findByRoleName("User"))
                .orElseThrow(() -> new BadRequestException("Default role not found."));

        User user = User.builder()
                .username(request.getUsername().trim())
                .email(request.getEmail().trim().toLowerCase())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .status(AccountStatus.PENDING_VERIFY)
                .role(userRole)
                .build();

        userRepository.save(user);

        otpService.generateAndSendRegistrationOtp(request.getEmail());

        return AuthResponse.builder()
                .token(null)
                .username(user.getUsername())
                .role(user.getRole().getRoleName())
                .build();
    }

    // =====================================================================================
    // KHỐI 2: XÁC THỰC MÃ OTP & KÍCH HOẠT TÀI KHOẢN (OTP VERIFICATION)
    // =====================================================================================
    /**
     * Xác thực mã OTP 6 số gửi qua email để chuyển trạng thái tài khoản từ PENDING_VERIFY sang ACTIVE.
     * [Business Rules]:
     * - Chỉ tài khoản ở trạng thái PENDING_VERIFY mới được phép kích hoạt.
     * - Khi kích hoạt thành công, tự động cấp ngay Access Token (JWT) để người dùng tự động đăng nhập.
     */
    @Transactional
    public AuthResponse verifyRegister(String email, String otpCode) {
        User user = userRepository.findByNormalizedEmail(email)
                .orElseThrow(() -> new BadRequestException("Account does not exist."));

        if (user.getStatus() == AccountStatus.ACTIVE) {
            throw new BadRequestException("This account has already been verified.");
        }

        if (user.getStatus() != AccountStatus.PENDING_VERIFY) {
            throw new BadRequestException("This account is in an invalid state.");
        }

        // Verify OTP
        otpService.verifyRegistrationOtp(email, otpCode);

        // Kích hoạt tài khoản
        user.setStatus(AccountStatus.ACTIVE);
        userRepository.save(user);

        String token = jwtTokenProvider.generateToken(
                user.getUsername(),
                user.getRole().getRoleName()
        );

        return AuthResponse.builder()
                .token(token)
                .username(user.getUsername())
                .role(user.getRole().getRoleName())
                .build();
    }

    /**
     * Gửi lại OTP cho email đã đăng ký.
     */
    @Transactional
    public void resendOtp(String email) {
        User user = userRepository.findByNormalizedEmail(email)
                .orElseThrow(() -> new BadRequestException("Account does not exist."));

        if (user.getStatus() == AccountStatus.ACTIVE) {
            throw new BadRequestException("This account has already been verified.");
        }

        if (user.getStatus() != AccountStatus.PENDING_VERIFY) {
            throw new BadRequestException("This account is in an invalid state.");
        }

        otpService.generateAndSendRegistrationOtp(email);
    }

    // =====================================================================================
    // KHỐI 3: XÁC THỰC ĐĂNG NHẬP & CẤP TOKEN (LOGIN & JWT GENERATION)
    // =====================================================================================
    /**
     * Xác thực đăng nhập bằng Username hoặc Email và cấp JWT Token.
     * [Business Rules & Security Standards]:
     * - BL-003 (Chống Account Enumeration): Luôn trả về thông báo lỗi chung "Incorrect email or password."
     *   kể cả khi sai username hay sai password, tránh kẻ tấn công dò quét email có tồn tại trong hệ thống.
     * - BL-026 (Kiểm soát trạng thái tài khoản thời gian thực): Chỉ tài khoản ACTIVE mới được cấp token;
     *   tài khoản PENDING_VERIFY hoặc BANNED/SUSPENDED bị chặn kèm lý do cụ thể.
     */
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByNormalizedUsernameOrEmail(request.getUsernameOrEmail())
                .orElse(null);

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.warn("Đăng nhập thất bại: thông tin xác thực không hợp lệ");
            throw new BadRequestException("Incorrect email or password.");
        }

        if (!AccountStatus.canAccessSystem(user.getStatus())) {
            log.warn("Đăng nhập bị từ chối: tài khoản {} đang có trạng thái {}", user.getUsername(), user.getStatus());
            switch (user.getStatus()) {
                case PENDING_VERIFY:
                    throw new BadRequestException("Your account is not verified. Please verify your email address.");
                case BANNED:
                    throw new BadRequestException("Your account has been locked. You cannot sign in.");
                default:
                    throw new BadRequestException("Invalid account.");
            }
        }

        String token = jwtTokenProvider.generateToken(
                user.getUsername(),
                user.getRole().getRoleName()
        );

        log.info("Đăng nhập thành công cho người dùng: {}", user.getUsername());

        return AuthResponse.builder()
                .token(token)
                .username(user.getUsername())
                .role(user.getRole().getRoleName())
                .build();
    }

    @Transactional(readOnly = true)
    public Optional<User> getUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    @Transactional(readOnly = true)
    public Optional<String> getRoleNameByUsername(String username) {
        return userRepository.findByUsername(username)
                .filter(user -> AccountStatus.canAccessSystem(user.getStatus()))
                .map(user -> user.getRole().getRoleName());
    }

    // =====================================================================================
    // KHỐI 4: ĐĂNG NHẬP GOOGLE OAUTH2 (SOCIAL LOGIN & FEDERATED IDENTITY)
    // =====================================================================================
    /**
     * Xử lý đăng nhập thông qua Google OAuth2.
     * [Business Rules]:
     * - Nếu email đã tồn tại: Cập nhật thông tin avatar, tự động kích hoạt tài khoản nếu đang PENDING_VERIFY.
     * - Nếu email chưa tồn tại: Tạo mới tài khoản với authProvider = "GOOGLE", hasPassword = false, status = ACTIVE.
     * - Khóa truy cập ngay lập tức nếu tài khoản bị BANNED/SUSPENDED.
     */
    @Transactional
    public AuthResponse handleOAuth2Login(String email, String fullName, String picture) {
        Optional<User> existingUser = userRepository.findByEmail(email);
        log.info("OAuth2 account lookup: existingAccount={}", existingUser.isPresent());

        User user;
        if (existingUser.isPresent()) {
            user = existingUser.get();
            // Cập nhật fullName và avatar nếu đang trống
            boolean updated = false;
            if ((user.getFullName() == null || user.getFullName().isBlank()) && fullName != null && !fullName.isBlank()) {
                user.setFullName(fullName);
                updated = true;
            }
            if ((user.getAvatarUrl() == null || user.getAvatarUrl().isBlank()) && picture != null && !picture.isBlank()) {
                user.setAvatarUrl(picture);
                updated = true;
            }
            // Nếu account đang PENDING_VERIFY mà login Google → tự activate
            if (user.getStatus() == AccountStatus.PENDING_VERIFY) {
                user.setStatus(AccountStatus.ACTIVE);
                updated = true;
            }
            if (updated) {
                user = userRepository.save(user);
            }
        } else {
            Role userRole = roleRepository.findByRoleName("ROLE_USER")
                    .or(() -> roleRepository.findByRoleName("User"))
                    .orElseThrow(() -> new BadRequestException("Default role not found."));

            String randomPassword = java.util.UUID.randomUUID().toString();
            String username = generateUniqueUsername(fullName != null ? fullName : email.split("@")[0]);

            user = User.builder()
                    .username(username)
                    .email(email.trim().toLowerCase())
                    .passwordHash(passwordEncoder.encode(randomPassword))
                    .fullName(fullName != null ? fullName : "")
                    .avatarUrl(picture)
                    .role(userRole)
                    .status(AccountStatus.ACTIVE)
                    .authProvider("GOOGLE")
                    .hasPassword(false)
                    .build();
            user = userRepository.save(user);
        }

        // Chỉ block các trạng thái không đủ điều kiện truy cập (ví dụ BANNED).
        if (user.getStatus() == AccountStatus.BANNED) {
            log.warn("OAuth2 account rejected because status is BANNED");
            throw new AccountBannedException();
        }
        if (!AccountStatus.canAccessSystem(user.getStatus())) {
            throw new BadRequestException("Your account has been locked or suspended.");
        }

        String token = jwtTokenProvider.generateToken(
                user.getUsername(),
                user.getRole().getRoleName()
        );

        return AuthResponse.builder()
                .token(token)
                .username(user.getUsername())
                .role(user.getRole().getRoleName())
                .build();
    }

    /**
     * Tạo username slug từ fullName, đảm bảo không trùng lặp.
     * VD: "Tên Người Dùng" → "ten_nguoi_dung" hoặc "ten_nguoi_dung_1"
     */
    private String generateUniqueUsername(String name) {
        String base = name.toLowerCase()
                .trim()
                .replaceAll("[^a-z0-9\\s]", "")   // bỏ ký tự đặc biệt
                .replaceAll("\\s+", "_");          // khoảng trắng → gạch dưới

        // Loại bỏ dấu tiếng Việt
        base = removeAccents(base);

        if (base.isEmpty()) {
            base = "user";
        }

        String username = base;
        int counter = 1;
        while (userRepository.existsByUsername(username)) {
            username = base + "_" + counter;
            counter++;
        }
        return username;
    }

    /**
     * Loại bỏ dấu tiếng Việt.
     * VD: "tên_người_dùng" → "ten_nguoi_dung"
     */
    private String removeAccents(String input) {
        String normalized = java.text.Normalizer.normalize(input, java.text.Normalizer.Form.NFD);
        return normalized.replaceAll("\\p{M}", "");
    }
}
