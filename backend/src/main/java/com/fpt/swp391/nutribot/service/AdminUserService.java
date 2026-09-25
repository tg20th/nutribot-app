package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.AdminUserStatusRequest;
import com.fpt.swp391.nutribot.dto.response.AdminUserResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public PagedResponse<AdminUserResponse> getAllUsers(String keyword, String status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<User> allUsers = userRepository.findAll(pageable);

        List<User> filtered = allUsers.getContent();

        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.toLowerCase();
            filtered = filtered.stream()
                    .filter(u -> (u.getUsername() != null && u.getUsername().toLowerCase().contains(kw))
                            || (u.getEmail() != null && u.getEmail().toLowerCase().contains(kw))
                            || (u.getFullName() != null && u.getFullName().toLowerCase().contains(kw)))
                    .toList();
        }

        if (status != null && !status.isBlank()) {
            final String s = status.toUpperCase();
            filtered = filtered.stream()
                    .filter(u -> u.getStatus().equalsIgnoreCase(s))
                    .toList();
        }

        List<AdminUserResponse> responses = filtered.stream().map(this::toResponse).toList();
        return PagedResponse.<AdminUserResponse>builder()
                .content(responses)
                .page(page)
                .size(size)
                .totalElements(allUsers.getTotalElements())
                .totalPages(allUsers.getTotalPages())
                .first(page == 0)
                .last(responses.isEmpty() || page >= allUsers.getTotalPages() - 1)
                .build();
    }

    @Transactional
    public AdminUserResponse updateUserStatus(Integer userId, AdminUserStatusRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng với ID: " + userId));

        user.setStatus(request.getStatus().toUpperCase());
        User saved = userRepository.save(user);
        return toResponse(saved);
    }

    private AdminUserResponse toResponse(User user) {
        return AdminUserResponse.builder()
                .userId(user.getUserId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .roleName(user.getRole() != null ? user.getRole().getRoleName() : null)
                .status(user.getStatus())
                .strikeCount(user.getStrikeCount())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
