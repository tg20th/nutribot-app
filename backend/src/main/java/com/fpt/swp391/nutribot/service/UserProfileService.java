package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.AvatarResponse;
import com.fpt.swp391.nutribot.dto.request.ProfileUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.UserProfileResponse;
import com.fpt.swp391.nutribot.config.JwtTokenProvider;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.CloudinaryUploadException;
import com.fpt.swp391.nutribot.repository.UserRepository;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

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

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(String username) {
        User user = findUser(username);
        UserProfile profile = userProfileRepository.findById(user.getUserId()).orElse(null);
        return toResponse(user, profile);
    }

    @Transactional
    public UserProfileResponse updateProfile(String currentUsername, ProfileUpdateRequest request) {
        User user = findUser(currentUsername);
        String previousUsername = user.getUsername();
        String username = normalize(request.getUsername());
        String email = normalize(request.getEmail());

        if (username == null || username.length() < 3 || username.length() > 50) {
            throw new BadRequestException("Username must be between 3 and 50 characters.");
        }
        if (email == null || email.length() > 255) {
            throw new BadRequestException("A valid email is required.");
        }
        if (userRepository.existsByUsernameAndUserIdNot(username, user.getUserId())) {
            throw new BadRequestException("Username is already in use.");
        }
        if (userRepository.existsByEmailAndUserIdNot(email, user.getUserId())) {
            throw new BadRequestException("Email is already in use.");
        }

        user.setUsername(username);
        user.setEmail(email);
        user.setFullName(normalize(request.getFullName()));
        user.setBio(normalize(request.getBio()));
        User savedUser = userRepository.save(user);

        UserProfile profile = userProfileRepository.findById(user.getUserId())
                .orElseGet(() -> UserProfile.builder().user(savedUser).build());
        profile.setUser(savedUser);
        profile.setDateOfBirth(request.getDateOfBirth());
        profile.setGender(normalize(request.getGender()));
        userProfileRepository.save(profile);

        String refreshedToken = previousUsername.equals(savedUser.getUsername())
                ? null
                : jwtTokenProvider.generateToken(savedUser.getUsername(), savedUser.getRole().getRoleName());
        return toResponse(savedUser, profile, refreshedToken);
    }

    @Transactional
    public AvatarResponse updateAvatar(String username, MultipartFile file) {
        User user = findUser(username);
        validateImage(file);

        CloudinaryAvatarService.AvatarUploadResult uploadResult;
        try {
            uploadResult = cloudinaryAvatarService.uploadAvatar(file, user.getUserId());
        } catch (RuntimeException exception) {
            throw new CloudinaryUploadException(exception);
        }

        try {
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

    public AvatarResponse deleteAvatar(String username) {
        User user = findUser(username);
        String currentAvatarUrl = user.getAvatarUrl();
        user.setAvatarUrl(null);
        User savedUser = userRepository.saveAndFlush(user);

        try {
            cloudinaryAvatarService.deleteAvatarByUrl(currentAvatarUrl);
        } catch (RuntimeException cleanupException) {
            log.warn("Avatar URL was cleared for user {} but Cloudinary cleanup failed.", username, cleanupException);
        }

        return new AvatarResponse(savedUser.getAvatarUrl());
    }

    private User findUser(String username) {
        return userRepository.findByUsername(username)
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
                .map(Ingredient::getName)
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();

        return UserProfileResponse.builder()
                .userId(user.getUserId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .bio(user.getBio())
                .roleName(user.getRole() == null ? null : user.getRole().getRoleName())
                .strikeCount(user.getStrikeCount())
                .status(user.getStatus())
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
                .build();
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
