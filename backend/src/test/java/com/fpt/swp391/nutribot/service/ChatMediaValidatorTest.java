package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.ChatAttachmentRequest;
import com.fpt.swp391.nutribot.exception.InvalidMediaException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Kiểm thử ChatMediaValidator - NB-75 Chatbot Media")
class ChatMediaValidatorTest {

    private ChatMediaValidator validator;

    @BeforeEach
    void setUp() {
        validator = new ChatMediaValidator(10485760, 26214400);
    }

    private ChatAttachmentRequest image(String mime, byte[] data) {
        ChatAttachmentRequest req = new ChatAttachmentRequest();
        req.setType("IMAGE");
        req.setMimeType(mime);
        req.setDataBase64(Base64.getEncoder().encodeToString(data));
        return req;
    }

    private ChatAttachmentRequest video(String mime, byte[] data) {
        ChatAttachmentRequest req = new ChatAttachmentRequest();
        req.setType("VIDEO");
        req.setMimeType(mime);
        req.setDataBase64(Base64.getEncoder().encodeToString(data));
        req.setFilename("clip.mp4");
        return req;
    }

    @Test
    @DisplayName("List rỗng thì pass")
    void validate_emptyList_passes() {
        assertDoesNotThrow(() -> validator.validate(List.of()));
    }

    @Test
    @DisplayName("JPEG hợp lệ thì pass")
    void validate_validJpeg_passes() {
        byte[] jpeg = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0};
        assertDoesNotThrow(() -> validator.validate(List.of(image("image/jpeg", jpeg))));
    }

    @Test
    @DisplayName("PNG hợp lệ thì pass")
    void validate_validPng_passes() {
        byte[] png = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0};
        assertDoesNotThrow(() -> validator.validate(List.of(image("image/png", png))));
    }

    @Test
    @DisplayName("MIME không nằm trong allowlist thì ném lỗi")
    void validate_disallowedImageMime_throws() {
        byte[] data = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
        InvalidMediaException ex = assertThrows(InvalidMediaException.class,
                () -> validator.validate(List.of(image("image/gif", data))));
        assertTrue(ex.getMessage().contains("JPEG"));
    }

    @Test
    @DisplayName("Magic bytes không khớp MIME thì ném lỗi")
    void validate_imageMagicBytesMismatch_throws() {
        byte[] notPng = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
        InvalidMediaException ex = assertThrows(InvalidMediaException.class,
                () -> validator.validate(List.of(image("image/png", notPng))));
        assertTrue(ex.getMessage().contains("không khớp"));
    }

    @Test
    @DisplayName("Base64 không hợp lệ thì ném lỗi")
    void validate_invalidBase64_throws() {
        ChatAttachmentRequest req = new ChatAttachmentRequest();
        req.setType("IMAGE");
        req.setMimeType("image/jpeg");
        req.setDataBase64("not_base64_!@#");
        assertThrows(InvalidMediaException.class, () -> validator.validate(List.of(req)));
    }

    @Test
    @DisplayName("Nhiều hơn 1 attachment thì ném lỗi")
    void validate_moreThanOne_throws() {
        byte[] jpeg = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 0};
        byte[] png = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0, 0, 0};
        assertThrows(InvalidMediaException.class,
                () -> validator.validate(List.of(image("image/jpeg", jpeg), image("image/png", png))));
    }

    @Test
    @DisplayName("Video vượt quá max bytes thì ném lỗi")
    void validate_videoTooLarge_throws() {
        ChatMediaValidator small = new ChatMediaValidator(1024, 1024);
        byte[] data = new byte[2048];
        assertThrows(InvalidMediaException.class,
                () -> small.validate(List.of(video("video/mp4", data))));
    }

    @Test
    @DisplayName("Video MIME không cho phép thì ném lỗi")
    void validate_videoDisallowedMime_throws() {
        byte[] data = new byte[]{0, 0, 0, 0, 'f', 't', 'y', 'p', 0, 0, 0, 0};
        assertThrows(InvalidMediaException.class,
                () -> validator.validate(List.of(video("video/avi", data))));
    }

    @Test
    @DisplayName("Video MP4 magic bytes hợp lệ thì pass")
    void validate_validMp4_passes() {
        byte[] mp4 = new byte[]{0, 0, 0, 0x20, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'};
        assertDoesNotThrow(() -> validator.validate(List.of(video("video/mp4", mp4))));
    }
}
