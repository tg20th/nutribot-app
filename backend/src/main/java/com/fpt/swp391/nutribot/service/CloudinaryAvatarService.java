package com.fpt.swp391.nutribot.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.UUID;

@Service
public class CloudinaryAvatarService {

    private static final String AVATAR_FOLDER = "nutribot/avatars";

    private final Cloudinary cloudinary;
    private final String cloudName;
    private final String apiKey;
    private final String apiSecret;

    public CloudinaryAvatarService(
            Cloudinary cloudinary,
            @Value("${cloudinary.cloud-name:}") String cloudName,
            @Value("${cloudinary.api-key:}") String apiKey,
            @Value("${cloudinary.api-secret:}") String apiSecret) {
        this.cloudinary = cloudinary;
        this.cloudName = cloudName;
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
    }

    public AvatarUploadResult uploadAvatar(MultipartFile file, Integer userId) {
        ensureConfigured();
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Avatar image is required.");
        }
        if (userId == null) {
            throw new IllegalArgumentException("User ID is required for avatar upload.");
        }

        String publicId = userId + "_" + UUID.randomUUID();
        try {
            Map<?, ?> result = cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
                    "resource_type", "image",
                    "folder", AVATAR_FOLDER,
                    "public_id", publicId,
                    "overwrite", false));
            Object secureUrl = result.get("secure_url");
            Object uploadedPublicId = result.get("public_id");
            if (!(secureUrl instanceof String url) || !(uploadedPublicId instanceof String id)) {
                throw new IllegalStateException("Cloudinary did not return the avatar URL.");
            }
            return new AvatarUploadResult(url, id);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not read the avatar image.", exception);
        } catch (Exception exception) {
            if (exception instanceof IllegalStateException stateException
                    && "Cloudinary did not return the avatar URL.".equals(stateException.getMessage())) {
                throw stateException;
            }
            throw new IllegalStateException("Avatar upload failed.", exception);
        }
    }

    public void deleteAvatar(String publicId) {
        ensureConfigured();
        if (publicId == null || publicId.isBlank()) {
            return;
        }
        try {
            cloudinary.uploader().destroy(publicId, ObjectUtils.asMap("resource_type", "image"));
        } catch (Exception exception) {
            throw new IllegalStateException("Avatar cleanup failed.", exception);
        }
    }

    public void deleteAvatarByUrl(String secureUrl) {
        if (secureUrl == null || secureUrl.isBlank()) {
            return;
        }
        ensureConfigured();

        URI uri = URI.create(secureUrl);
        String expectedPrefix = "/" + cloudName + "/image/upload/";
        String path = uri.getPath();
        if (!"res.cloudinary.com".equalsIgnoreCase(uri.getHost()) || path == null || !path.startsWith(expectedPrefix)) {
            throw new IllegalArgumentException("Avatar URL does not belong to this Cloudinary account.");
        }

        String assetPath = path.substring(expectedPrefix.length());
        if (assetPath.matches("v\\d+/.+")) {
            assetPath = assetPath.substring(assetPath.indexOf('/') + 1);
        }
        String avatarPrefix = AVATAR_FOLDER + "/";
        if (!assetPath.startsWith(avatarPrefix)) {
            throw new IllegalArgumentException("Avatar URL is outside the NutriBot avatar folder.");
        }

        String publicId = assetPath.substring(0, assetPath.lastIndexOf('.') >= 0
                ? assetPath.lastIndexOf('.')
                : assetPath.length());
        deleteAvatar(publicId);
    }

    private void ensureConfigured() {
        if (cloudName.isBlank() || apiKey.isBlank() || apiSecret.isBlank()) {
            throw new IllegalStateException("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
        }
    }

    public record AvatarUploadResult(String secureUrl, String publicId) {
    }
}
