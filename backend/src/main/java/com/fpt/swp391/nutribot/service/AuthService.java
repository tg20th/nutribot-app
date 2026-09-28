package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.config.JwtTokenProvider;
import com.fpt.swp391.nutribot.dto.request.LoginRequest;
import com.fpt.swp391.nutribot.dto.request.RegisterRequest;
import com.fpt.swp391.nutribot.dto.response.AuthResponse;
import com.fpt.swp391.nutribot.entity.Role;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.repository.RoleRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

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
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BadRequestException("Username đã được sử dụng");
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email đã được sử dụng");
        }

        Role userRole = roleRepository.findByRoleName("ROLE_USER")
                .or(() -> roleRepository.findByRoleName("User"))
                .orElseThrow(() -> new BadRequestException("Không tìm thấy role mặc định"));

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .status("PENDING_VERIFY")
                .role(userRole)
                .build();

        userRepository.save(user);

        // Gửi OTP email
        otpService.generateAndSendOtp(request.getEmail());

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
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("Tài khoản không tồn tại"));

        if ("ACTIVE".equals(user.getStatus())) {
            throw new BadRequestException("Tài khoản đã được xác thực trước đó");
        }

        if (!"PENDING_VERIFY".equals(user.getStatus())) {
            throw new BadRequestException("Tài khoản đang ở trạng thái không hợp lệ");
        }

        // Verify OTP
        otpService.verifyOtp(email, otpCode);

        // Kích hoạt tài khoản
        user.setStatus("ACTIVE");
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
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("Tài khoản không tồn tại"));

        if ("ACTIVE".equals(user.getStatus())) {
            throw new BadRequestException("Tài khoản đã được xác thực trước đó");
        }

        if (!"PENDING_VERIFY".equals(user.getStatus())) {
            throw new BadRequestException("Tài khoản đang ở trạng thái không hợp lệ");
        }

        otpService.generateAndSendOtp(email);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsernameOrEmail())
                .or(() -> userRepository.findByEmail(request.getUsernameOrEmail()))
                .orElseThrow(() -> new BadRequestException("Tài khoản không tồn tại"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Mật khẩu không chính xác");
        }

        if (!"ACTIVE".equals(user.getStatus())) {
            if ("PENDING_VERIFY".equals(user.getStatus())) {
                throw new BadRequestException("Tài khoản chưa xác thực email. Vui lòng kiểm tra hộp thư.");
            }
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

    @Transactional(readOnly = true)
    public Optional<User> getUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    @Transactional(readOnly = true)
    public Optional<String> getRoleNameByUsername(String username) {
        return userRepository.findByUsername(username)
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
            if ("PENDING_VERIFY".equals(user.getStatus())) {
                user.setStatus("ACTIVE");
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
                    .email(email)
                    .passwordHash(passwordEncoder.encode(randomPassword))
                    .fullName(fullName != null ? fullName : "")
                    .avatarUrl(picture)
                    .role(userRole)
                    .build();
            user = userRepository.save(user);
        }

        // Chỉ block account bị khóa thực sự (SUSPENDED, BANNED, WARN)
        if (!"ACTIVE".equals(user.getStatus())) {
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
