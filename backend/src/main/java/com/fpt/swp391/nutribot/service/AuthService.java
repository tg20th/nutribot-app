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
                .role(userRole)
                .build();

        User savedUser = userRepository.save(user);

        String token = jwtTokenProvider.generateToken(
                savedUser.getUsername(),
                savedUser.getRole().getRoleName()
        );

        return AuthResponse.builder()
                .token(token)
                .username(savedUser.getUsername())
                .role(savedUser.getRole().getRoleName())
                .build();
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
}
