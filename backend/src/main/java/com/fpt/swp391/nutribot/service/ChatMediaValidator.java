package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.ChatAttachmentRequest;
import com.fpt.swp391.nutribot.exception.InvalidMediaException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class ChatMediaValidator {

    private static final Map<String, byte[]> IMAGE_SIGNATURES = Map.of(
            "image/jpeg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF},
            "image/png", new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A},
            "image/webp", new byte[]{0x52, 0x49, 0x46, 0x46} // "RIFF"
    );

    private static final Set<String> IMAGE_MIME_ALLOWLIST = Set.of("image/jpeg", "image/png", "image/webp");
    private static final Set<String> VIDEO_MIME_ALLOWLIST = Set.of(
            "video/mp4", "video/webm", "video/quicktime"
    );
    private static final Set<String> YOUTUBE_HOSTS =
            Set.of("youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be");
    private static final Pattern YOUTUBE_ID = Pattern.compile("[A-Za-z0-9_-]{11}");
    private static final int MAX_URL_LENGTH = 500;

    private final int maxImageBytes;
    private final int maxVideoBytes;

    public ChatMediaValidator(
            @Value("${app.chatbot.max-image-bytes:10485760}") int maxImageBytes,
            @Value("${app.chatbot.max-video-bytes:26214400}") int maxVideoBytes) {
        this.maxImageBytes = maxImageBytes;
        this.maxVideoBytes = maxVideoBytes;
    }

    public void validate(List<ChatAttachmentRequest> attachments) {
        if (attachments == null || attachments.isEmpty()) {
            return;
        }
        if (attachments.size() > 1) {
            throw new InvalidMediaException("Chỉ được gửi tối đa một đính kèm trong mỗi lượt chat.");
        }
        for (ChatAttachmentRequest attachment : attachments) {
            validateOne(attachment);
        }
    }

    public void validateOne(ChatAttachmentRequest attachment) {
        if (attachment == null) {
            throw new InvalidMediaException("Đính kèm không hợp lệ.");
        }
        String type = attachment.getType();
        if (type == null) {
            throw new InvalidMediaException("Thiếu loại đính kèm (IMAGE/VIDEO).");
        }
        if (!"IMAGE".equals(type) && !"VIDEO".equals(type)) {
            throw new InvalidMediaException("Loại đính kèm phải là IMAGE hoặc VIDEO.");
        }

        String url = attachment.getUrl();
        boolean hasUrl = url != null && !url.isBlank();
        String dataBase64 = attachment.getDataBase64();
        boolean hasBase64 = dataBase64 != null && !dataBase64.isBlank();
        String mime = normalizeMime(attachment.getMimeType());

        if ("IMAGE".equals(type)) {
            if (hasUrl) {
                throw new InvalidMediaException("Ảnh không hỗ trợ URL, vui lòng tải ảnh lên.");
            }
            if (!IMAGE_MIME_ALLOWLIST.contains(mime)) {
                throw new InvalidMediaException("Ảnh phải có định dạng JPEG, PNG hoặc WebP.");
            }
            byte[] decoded = decodeBase64(dataBase64, hasBase64);
            if (decoded.length > maxImageBytes) {
                throw new InvalidMediaException("Ảnh vượt quá " + (maxImageBytes / (1024 * 1024)) + " MB cho phép.");
            }
            byte[] signature = IMAGE_SIGNATURES.get(mime);
            if (signature == null || !startsWith(decoded, signature)) {
                throw new InvalidMediaException("Nội dung ảnh không khớp với MIME đã khai báo.");
            }
            return;
        }

        if (hasUrl && hasBase64) {
            throw new InvalidMediaException("Chỉ được gửi một URL video hoặc một video tải lên.");
        }
        if (hasUrl) {
            validateVideoUrl(url);
            return;
        }
        if (!VIDEO_MIME_ALLOWLIST.contains(mime)) {
            throw new InvalidMediaException("Video phải có định dạng MP4, WebM hoặc QuickTime.");
        }
        byte[] decoded = decodeBase64(dataBase64, hasBase64);
        if (decoded.length > maxVideoBytes) {
            throw new InvalidMediaException("Video vượt quá " + (maxVideoBytes / (1024 * 1024)) + " MB cho phép.");
        }
    }

    public String validateVideoUrl(String url) {
        if (url == null || url.isBlank()) {
            throw new InvalidMediaException("URL video không được trống.");
        }
        String normalized = url.trim();
        if (normalized.length() > MAX_URL_LENGTH) {
            throw new InvalidMediaException("URL video vượt quá " + MAX_URL_LENGTH + " ký tự.");
        }
        URI uri;
        try {
            uri = new URI(normalized);
        } catch (URISyntaxException ex) {
            throw new InvalidMediaException("URL video không hợp lệ.");
        }
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw new InvalidMediaException("URL video phải dùng giao thức HTTPS.");
        }
        String host = uri.getHost() == null ? null : uri.getHost().toLowerCase();
        if (host == null || !YOUTUBE_HOSTS.contains(host)) {
            throw new InvalidMediaException("Chỉ hỗ trợ URL video YouTube.");
        }
        String videoId = extractYouTubeId(uri, host);
        if (videoId == null || !YOUTUBE_ID.matcher(videoId).matches()) {
            throw new InvalidMediaException("Video ID YouTube không hợp lệ hoặc URL chỉ chứa playlist.");
        }
        return url.trim();
    }

    private String extractYouTubeId(URI uri, String host) {
        String path = uri.getPath() == null ? "" : uri.getPath();
        if ("youtu.be".equals(host)) {
            String candidate = path.startsWith("/") ? path.substring(1) : path;
            return candidate.isEmpty() || candidate.contains("/") ? null : candidate;
        }
        if ("/watch".equals(path)) {
            String query = uri.getRawQuery();
            if (query == null) {
                return null;
            }
            List<String> values = new ArrayList<>();
            for (String pair : query.split("&")) {
                if (pair.startsWith("v=")) {
                    values.add(pair.substring(2));
                }
            }
            return values.size() == 1 ? values.get(0) : null;
        }
        List<String> segments = new ArrayList<>();
        for (String part : path.split("/")) {
            if (!part.isEmpty()) {
                segments.add(part);
            }
        }
        if (segments.size() == 2
                && (segments.get(0).equals("shorts")
                || segments.get(0).equals("embed")
                || segments.get(0).equals("live"))) {
            return segments.get(1);
        }
        return null;
    }

    private byte[] decodeBase64(String dataBase64, boolean hasBase64) {
        if (!hasBase64) {
            throw new InvalidMediaException("Dữ liệu đính kèm rỗng.");
        }
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(dataBase64);
        } catch (IllegalArgumentException ex) {
            throw new InvalidMediaException("Dữ liệu Base64 không hợp lệ.");
        }
        if (decoded.length == 0) {
            throw new InvalidMediaException("Dữ liệu đính kèm rỗng sau khi giải mã.");
        }
        return decoded;
    }

    public String normalizeMime(String mime) {
        if (mime == null) return "";
        int semi = mime.indexOf(';');
        String base = (semi >= 0 ? mime.substring(0, semi) : mime).trim().toLowerCase();
        return base;
    }

    private boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) return false;
        }
        return true;
    }
}
