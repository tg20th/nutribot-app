package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.ChatAttachmentRequest;
import com.fpt.swp391.nutribot.exception.InvalidMediaException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
        String mime = normalizeMime(attachment.getMimeType());
        if (type == null) {
            throw new InvalidMediaException("Thiếu loại đính kèm (IMAGE/VIDEO).");
        }
        if ("IMAGE".equals(type)) {
            if (!IMAGE_MIME_ALLOWLIST.contains(mime)) {
                throw new InvalidMediaException("Ảnh phải có định dạng JPEG, PNG hoặc WebP.");
            }
        } else if ("VIDEO".equals(type)) {
            if (!VIDEO_MIME_ALLOWLIST.contains(mime)) {
                throw new InvalidMediaException("Video phải có định dạng MP4, WebM hoặc QuickTime.");
            }
        } else {
            throw new InvalidMediaException("Loại đính kèm phải là IMAGE hoặc VIDEO.");
        }

        if (attachment.getDataBase64() == null || attachment.getDataBase64().isBlank()) {
            throw new InvalidMediaException("Dữ liệu đính kèm rỗng.");
        }

        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(attachment.getDataBase64());
        } catch (IllegalArgumentException ex) {
            throw new InvalidMediaException("Dữ liệu Base64 không hợp lệ.");
        }
        if (decoded.length == 0) {
            throw new InvalidMediaException("Dữ liệu đính kèm rỗng sau khi giải mã.");
        }

        int maxBytes = "IMAGE".equals(type) ? maxImageBytes : maxVideoBytes;
        if (decoded.length > maxBytes) {
            String label = "IMAGE".equals(type) ? "Ảnh" : "Video";
            int maxMb = maxBytes / (1024 * 1024);
            throw new InvalidMediaException(label + " vượt quá " + maxMb + " MB cho phép.");
        }

        if ("IMAGE".equals(type)) {
            byte[] signature = IMAGE_SIGNATURES.get(mime);
            if (signature == null || !startsWith(decoded, signature)) {
                throw new InvalidMediaException("Nội dung ảnh không khớp với MIME đã khai báo.");
            }
        }
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
