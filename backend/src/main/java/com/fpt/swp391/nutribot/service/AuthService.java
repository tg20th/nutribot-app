package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.config.JwtTokenProvider;
import com.fpt.swp391.nutribot.dto.request.LoginRequest;
import com.fpt.swp391.nutribot.dto.request.RegisterRequest;
import com.fpt.swp391.nutribot.dto.response.AuthResponse;
import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.Role;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.repository.RoleRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final OtpService otpService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByNormalizedUsername(request.getUsername())) {
            throw new BadRequestException("Username đã được sử dụng");
        }

        if (userRepository.existsByNormalizedEmail(request.getEmail())) {
            throw new BadRequestException("Email đã được sử dụng");
        }

        Role userRole = roleRepository.findByRoleName("ROLE_USER")
                .or(() -> roleRepository.findByRoleName("User"))
                .orElseThrow(() -> new BadRequestException("Không tìm thấy role mặc định"));

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

    /**
     * Verify OTP để kích hoạt tài khoản.
     */
    @Transactional
    public AuthResponse verifyRegister(String email, String otpCode) {
        User user = userRepository.findByNormalizedEmail(email)
                .orElseThrow(() -> new BadRequestException("Tài khoản không tồn tại"));

        if (user.getStatus() == AccountStatus.ACTIVE) {
            throw new BadRequestException("Tài khoản đã được xác thực trước đó");
        }

        if (user.getStatus() != AccountStatus.PENDING_VERIFY) {
            throw new BadRequestException("Tài khoản đang ở trạng thái không hợp lệ");
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
                .orElseThrow(() -> new BadRequestException("Tài khoản không tồn tại"));

        if (user.getStatus() == AccountStatus.ACTIVE) {
            throw new BadRequestException("Tài khoản đã được xác thực trước đó");
        }

        if (user.getStatus() != AccountStatus.PENDING_VERIFY) {
            throw new BadRequestException("Tài khoản đang ở trạng thái không hợp lệ");
        }

        otpService.generateAndSendRegistrationOtp(email);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByNormalizedUsernameOrEmail(request.getUsernameOrEmail())
                .orElse(null);

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.warn("Đăng nhập thất bại: thông tin xác thực không hợp lệ");
            throw new BadRequestException("Tài khoản hoặc mật khẩu không chính xác");
        }

        if (user.getStatus() != AccountStatus.ACTIVE) {
            log.warn("Đăng nhập bị từ chối: tài khoản {} đang có trạng thái {}", user.getUsername(), user.getStatus());
            switch (user.getStatus()) {
                case PENDING_VERIFY:
                    throw new BadRequestException("Tài khoản chưa xác thực email. Vui lòng kiểm tra hộp thư.");
                case WARN:
                    throw new BadRequestException("Tài khoản đang bị cảnh báo. Vui lòng liên hệ hỗ trợ.");
                case BANNED:
                    throw new BadRequestException("Tài khoản đã bị khóa. Không thể đăng nhập.");
                default:
                    throw new BadRequestException("Tài khoản không hợp lệ.");
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
                .filter(user -> user.getStatus() == AccountStatus.ACTIVE)
                .map(user -> user.getRole().getRoleName());
    }

    @Transactional
    public AuthResponse handleOAuth2Login(String email, String fullName, String picture) {
        Optional<User> existingUser = userRepository.findByEmail(email);

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
                    .orElseThrow(() -> new BadRequestException("Không tìm thấy role mặc định"));

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
                    .build();
            user = userRepository.save(user);
        }

        // Chỉ block account bị khóa thực sự (SUSPENDED, BANNED, WARN)
        if (user.getStatus() != AccountStatus.ACTIVE) {
            throw new BadRequestException("Tài khoản đã bị khóa hoặc suspend");
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
