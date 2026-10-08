package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.AvatarResponse;
import com.fpt.swp391.nutribot.dto.request.ProfileUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.UserProfileResponse;
import com.fpt.swp391.nutribot.config.JwtTokenProvider;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.entity.UserAllergy;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.ConflictException;
import com.fpt.swp391.nutribot.exception.CloudinaryUploadException;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import com.fpt.swp391.nutribot.dto.request.PasswordUpdateRequest;
import org.springframework.security.crypto.password.PasswordEncoder;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserProfileService {

    private static final long MAX_AVATAR_SIZE = 5L * 1024 * 1024;
    private static final Map<String, String> MIME_TO_FORMAT = Map.of(
            "image/png", "png",
            "image/jpeg", "jpeg",
            "image/webp", "webp");

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final CloudinaryAvatarService cloudinaryAvatarService;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmailChangeService emailChangeService;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(String username) {
        User user = findUser(username);
        UserProfile profile = userProfileRepository.findById(user.getUserId()).orElse(null);
        return toResponse(user, profile);
    }

    @Transactional
    public UserProfileResponse updateProfile(String currentUsername, ProfileUpdateRequest request) {
        User user = findUserForUpdate(currentUsername);
        String previousUsername = user.getUsername();
        String username = normalize(request.getUsername());
        String email = normalize(request.getEmail());

        if (username == null || username.length() < 3 || username.length() > 50) {
            throw new BadRequestException("Username must be between 3 and 50 characters.");
        }
        if (email == null || email.length() > 255) {
            throw new BadRequestException("A valid email is required.");
        }
        if (userRepository.existsByUsernameIgnoreCaseAndUserIdNot(username, user.getUserId())) {
            throw new ConflictException("Username is already in use.");
        }
        emailChangeService.requestEmailChange(user, email);

        user.setUsername(username);
        user.setFullName(normalize(request.getFullName()));
        user.setBio(normalize(request.getBio()));
        User savedUser;
        try {
            // The database unique constraints remain authoritative if another
            // account claims this username after the pre-check above.
            savedUser = userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Username is already in use.");
        }

        UserProfile profile = userProfileRepository.findById(user.getUserId())
                .orElseGet(() -> UserProfile.builder().user(savedUser).build());
        profile.setUser(savedUser);
        profile.setDateOfBirth(request.getDateOfBirth());
        profile.setGender(normalizeGender(request.getGender()));
        userProfileRepository.saveAndFlush(profile);

        String refreshedToken = previousUsername.equals(savedUser.getUsername())
                ? null
                : jwtTokenProvider.generateToken(savedUser.getUsername(), savedUser.getRole().getRoleName());
        return toResponse(savedUser, profile, refreshedToken);
    }

    @Transactional
    public AvatarResponse updateAvatar(String username, MultipartFile file) {
        validateImage(file);
        User identifiedUser = findUser(username);

        CloudinaryAvatarService.AvatarUploadResult uploadResult;
        try {
            uploadResult = cloudinaryAvatarService.uploadAvatar(file, identifiedUser.getUserId());
        } catch (RuntimeException exception) {
            throw new CloudinaryUploadException(exception);
        }

        try {
            User user = userRepository.findByIdForUpdate(identifiedUser.getUserId())
                    .orElseThrow(() -> new BadRequestException("User profile was not found."));
            user.setAvatarUrl(uploadResult.secureUrl());
            User savedUser = userRepository.saveAndFlush(user);
            return new AvatarResponse(savedUser.getAvatarUrl());
        } catch (RuntimeException persistenceException) {
            try {
                cloudinaryAvatarService.deleteAvatar(uploadResult.publicId());
            } catch (RuntimeException cleanupException) {
                persistenceException.addSuppressed(cleanupException);
            }
            throw new IllegalStateException("Unable to save the new avatar. The existing avatar is unchanged.", persistenceException);
        }
    }

    @Transactional
    public AvatarResponse deleteAvatar(String username) {
        User user = findUserForUpdate(username);
        String currentAvatarUrl = user.getAvatarUrl();
        user.setAvatarUrl(null);
        User savedUser = userRepository.saveAndFlush(user);

        if (currentAvatarUrl != null && TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    cleanupDeletedAvatar(currentAvatarUrl, username);
                }
            });
        } else if (currentAvatarUrl != null) {
            cleanupDeletedAvatar(currentAvatarUrl, username);
        }

        return new AvatarResponse(savedUser.getAvatarUrl());
    }

    private User findUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new BadRequestException("User profile was not found."));
    }

    private User findUserForUpdate(String username) {
        return userRepository.findByUsernameForUpdate(username)
                .orElseThrow(() -> new BadRequestException("User profile was not found."));
    }

    private UserProfileResponse toResponse(User user, UserProfile profile) {
        return toResponse(user, profile, null);
    }

    private UserProfileResponse toResponse(User user, UserProfile profile, String refreshedToken) {
        BigDecimal height = profile == null ? null : profile.getHeightCm();
        BigDecimal weight = profile == null ? null : profile.getWeightKg();
        BigDecimal bmi = calculateBmi(height, weight);
        List<String> allergies = profile == null ? List.of() : profile.getAllergies().stream()
                .map(ua -> ua.getIngredient().getName())
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();

        return UserProfileResponse.builder()
                .userId(user.getUserId())
                .username(user.getUsername())
                .email(user.getEmail())
                .pendingEmail(emailChangeService.getPendingEmail(user.getUserId()))
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .bio(user.getBio())
                .roleName(user.getRole() == null ? null : user.getRole().getRoleName())
                .strikeCount(user.getStrikeCount())
                .status(user.getStatus() != null ? user.getStatus().name() : null)
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .heightCm(height)
                .weightKg(weight)
                .bmi(bmi)
                .bmiCategory(categorizeBmi(bmi))
                .gender(profile == null ? null : profile.getGender())
                .dateOfBirth(profile == null ? null : profile.getDateOfBirth())
                .healthGoal(profile == null ? null : profile.getHealthGoal())
                .allergies(allergies)
                .token(refreshedToken)
                .hasPassword(Boolean.TRUE.equals(user.getHasPassword()))
                .authProvider(user.getAuthProvider() != null ? user.getAuthProvider() : "LOCAL")
                .build();
    }

    @Transactional
    public UserProfileResponse changePassword(String currentUsername, PasswordUpdateRequest request) {
        if (request == null) {
            throw new BadRequestException("Dữ liệu yêu cầu không được để trống.");
        }
        String newPassword = request.getNewPassword();
        String confirmPassword = request.getConfirmPassword();
        if (newPassword == null || newPassword.isBlank()) {
            throw new BadRequestException("Mật khẩu mới không được để trống.");
        }
        if (confirmPassword == null || confirmPassword.isBlank()) {
            throw new BadRequestException("Vui lòng xác nhận mật khẩu mới.");
        }
        if (!newPassword.equals(confirmPassword)) {
            throw new BadRequestException("Mật khẩu xác nhận không khớp.");
        }

        User user = findUserForUpdate(currentUsername);
        boolean hasPassword = Boolean.TRUE.equals(user.getHasPassword());

        if (hasPassword) {
            String currentPassword = request.getCurrentPassword();
            if (currentPassword == null || currentPassword.isBlank()) {
                throw new BadRequestException("Vui lòng nhập mật khẩu hiện tại.");
            }
            if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
                throw new BadRequestException("Mật khẩu hiện tại không chính xác.");
            }
            if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
                throw new BadRequestException("Mật khẩu mới phải khác mật khẩu hiện tại.");
            }
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setHasPassword(true);
        User savedUser = userRepository.saveAndFlush(user);

        UserProfile profile = userProfileRepository.findById(savedUser.getUserId()).orElse(null);
        return toResponse(savedUser, profile);
    }

    private BigDecimal calculateBmi(BigDecimal heightCm, BigDecimal weightKg) {
        if (heightCm == null || weightKg == null || heightCm.signum() <= 0 || weightKg.signum() <= 0) {
            return null;
        }
        BigDecimal heightMeters = heightCm.movePointLeft(2);
        return weightKg.divide(heightMeters.multiply(heightMeters), 1, RoundingMode.HALF_UP);
    }

    private String categorizeBmi(BigDecimal bmi) {
        if (bmi == null) return null;
        if (bmi.compareTo(new BigDecimal("18.5")) < 0) return "Thi?u c?n";
        if (bmi.compareTo(new BigDecimal("25.0")) < 0) return "B?nh th??ng";
        if (bmi.compareTo(new BigDecimal("30.0")) < 0) return "Th?a c?n";
        return "B?o ph?";
    }

    private String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeGender(String value) {
        String normalized = normalize(value);
        if (normalized == null) return null;
        return switch (normalized.toLowerCase(Locale.ROOT)) {
            case "female" -> "Female";
            case "male" -> "Male";
            case "other" -> "Other";
            default -> throw new BadRequestException("Gender must be Male, Female, Other, or blank.");
        };
    }

    private void cleanupDeletedAvatar(String avatarUrl, String username) {
        try {
            cloudinaryAvatarService.deleteAvatarByUrl(avatarUrl);
        } catch (RuntimeException cleanupException) {
            log.warn("Avatar URL was cleared for user {} but Cloudinary cleanup failed.", username, cleanupException);
        }
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Choose an image file to upload.");
        }
        if (file.getSize() > MAX_AVATAR_SIZE) {
            throw new BadRequestException("Avatar images must be 5 MB or smaller.");
        }

        String contentType = file.getContentType();
        String expectedFormat = MIME_TO_FORMAT.get(contentType == null ? "" : contentType.toLowerCase(Locale.ROOT));
        if (expectedFormat == null) {
            throw new BadRequestException("Avatar images must be PNG, JPEG, or WebP.");
        }

        try {
            String decodedFormat = decodeImageFormat(file.getBytes());
            if (!expectedFormat.equals(decodedFormat)) {
                throw new BadRequestException("The image content does not match its declared file type.");
            }
        } catch (IOException | RuntimeException exception) {
            if (exception instanceof BadRequestException badRequestException) {
                throw badRequestException;
            }
            throw new BadRequestException("The uploaded file is not a valid image.");
        }
    }

    private String decodeImageFormat(byte[] bytes) throws IOException {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (input == null) {
                throw new IOException("Unsupported image data.");
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw new IOException("Unsupported image data.");
            }

            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (reader.read(0) == null) {
                    throw new IOException("Image could not be decoded.");
                }
                return format;
            } finally {
                reader.dispose();
            }
        }
    }
}
