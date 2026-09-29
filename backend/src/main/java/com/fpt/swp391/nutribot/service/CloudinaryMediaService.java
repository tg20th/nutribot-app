package com.fpt.swp391.nutribot.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
public class CloudinaryMediaService {

    private static final String THUMBNAIL_FOLDER = "nutribot/thumbnails";
    private static final String VIDEO_FOLDER = "nutribot/videos";
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    private static final long MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
    private static final List<String> ALLOWED_MIME_TYPES = List.of(
            "image/jpeg",
            "image/png",
            "image/webp"
    );

    private final Cloudinary cloudinary;
    private final String cloudName;
    private final String apiKey;
    private final String apiSecret;

    public CloudinaryMediaService(
            Cloudinary cloudinary,
            @Value("${cloudinary.cloud-name:}") String cloudName,
            @Value("${cloudinary.api-key:}") String apiKey,
            @Value("${cloudinary.api-secret:}") String apiSecret) {
        this.cloudinary = cloudinary;
        this.cloudName = cloudName != null ? cloudName.trim() : "";
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.apiSecret = apiSecret != null ? apiSecret.trim() : "";
    }

    public MediaUploadResult uploadThumbnail(MultipartFile file, Integer userId) {
        ensureConfigured();

        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Vui lòng chọn hình ảnh để tải lên");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("Dung lượng ảnh thu nhỏ không được vượt quá 5MB");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
            throw new BadRequestException("Chỉ chấp nhận định dạng ảnh JPG, PNG hoặc WebP");
        }

        if (userId == null) {
            throw new BadRequestException("Thông tin người dùng không hợp lệ");
        }

        String publicId = "thumb_" + userId + "_" + UUID.randomUUID().toString().replace("-", "");
        try {
            Map<?, ?> result = cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
                    "resource_type", "image",
                    "folder", THUMBNAIL_FOLDER,
                    "public_id", publicId,
                    "overwrite", false
            ));

            Object secureUrl = result.get("secure_url");
            Object uploadedPublicId = result.get("public_id");
            if (!(secureUrl instanceof String url) || !(uploadedPublicId instanceof String id)) {
                throw new IllegalStateException("Cloudinary không trả về URL ảnh hợp lệ.");
            }
            return new MediaUploadResult(url, id);
        } catch (IOException ex) {
            log.error("Lỗi khi đọc file ảnh: ", ex);
            throw new BadRequestException("Không thể đọc tệp ảnh tải lên");
        } catch (Exception ex) {
            log.error("Lỗi khi tải ảnh lên Cloudinary: ", ex);
            throw new BadRequestException("Tải ảnh thu nhỏ thất bại. Vui lòng thử lại sau.");
        }
    }

    /** Upload a native MP4 clip.  The resulting secure URL is persisted in contents.media_url. */
    public MediaUploadResult uploadVideo(MultipartFile file, Integer userId) {
        ensureConfigured();
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Vui lòng chọn tệp video MP4 để tải lên");
        }
        if (file.getSize() > MAX_VIDEO_FILE_SIZE) {
            throw new BadRequestException("Dung lượng video không được vượt quá 100MB");
        }
        if (!"video/mp4".equalsIgnoreCase(file.getContentType())) {
            throw new BadRequestException("Chỉ chấp nhận tệp video định dạng MP4");
        }
        if (userId == null) {
            throw new BadRequestException("Thông tin người dùng không hợp lệ");
        }

        String publicId = "video_" + userId + "_" + UUID.randomUUID().toString().replace("-", "");
        try {
            Map<?, ?> result = cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
                    "resource_type", "video",
                    "folder", VIDEO_FOLDER,
                    "public_id", publicId,
                    "overwrite", false
            ));
            Object secureUrl = result.get("secure_url");
            Object uploadedPublicId = result.get("public_id");
            if (!(secureUrl instanceof String url) || !(uploadedPublicId instanceof String id)) {
                throw new IllegalStateException("Cloudinary không trả về URL video hợp lệ.");
            }
            return new MediaUploadResult(url, id);
        } catch (IOException ex) {
            log.error("Lỗi khi đọc tệp video: ", ex);
            throw new BadRequestException("Không thể đọc tệp video tải lên");
        } catch (Exception ex) {
            log.error("Lỗi khi tải video lên Cloudinary: ", ex);
            throw new BadRequestException("Tải video thất bại. Vui lòng thử lại sau.");
        }
    }

    public void deleteThumbnailByUrl(String secureUrl) {
        deleteMediaByUrl(secureUrl, "image", THUMBNAIL_FOLDER);
    }

    public void deleteVideoByUrl(String secureUrl) {
        deleteMediaByUrl(secureUrl, "video", VIDEO_FOLDER);
    }

    private void deleteMediaByUrl(String secureUrl, String resourceType, String folder) {
        if (secureUrl == null || secureUrl.isBlank()) {
            return;
        }
        if (cloudName.isBlank() || apiKey.isBlank() || apiSecret.isBlank()) {
            return;
        }

        try {
            URI uri = URI.create(secureUrl);
            String expectedPrefix = "/" + cloudName + "/" + resourceType + "/upload/";
            String path = uri.getPath();
            if (!"res.cloudinary.com".equalsIgnoreCase(uri.getHost()) || path == null || !path.startsWith(expectedPrefix)) {
                return;
            }

            String assetPath = path.substring(expectedPrefix.length());
            if (assetPath.matches("v\\d+/.+")) {
                assetPath = assetPath.substring(assetPath.indexOf('/') + 1);
            }
            String mediaPrefix = folder + "/";
            if (!assetPath.startsWith(mediaPrefix)) {
                return;
            }

            String publicId = assetPath.substring(0, assetPath.lastIndexOf('.') >= 0
                    ? assetPath.lastIndexOf('.')
                    : assetPath.length());

            cloudinary.uploader().destroy(publicId, ObjectUtils.asMap("resource_type", resourceType));
            log.info("Đã dọn dẹp media cũ trên Cloudinary: {}", publicId);
        } catch (Exception ex) {
            log.warn("Không thể xóa ảnh thumbnail trên Cloudinary (url: {}): {}", secureUrl, ex.getMessage());
        }
    }

    private void ensureConfigured() {
        if (cloudName.isBlank() || apiKey.isBlank() || apiSecret.isBlank()) {
            throw new BadRequestException("Hệ thống lưu trữ ảnh chưa được cấu hình. Vui lòng liên hệ quản trị viên.");
        }
    }

    public record MediaUploadResult(String secureUrl, String publicId) {
    }
}
