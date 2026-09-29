package com.fpt.swp391.nutribot.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử CloudinaryMediaService (Upload Thumbnail & Orphan Cleanup)")
class CloudinaryMediaServiceTest {

    @Mock
    private Cloudinary cloudinary;

    @Mock
    private Uploader uploader;

    private CloudinaryMediaService mediaService;

    @BeforeEach
    void setUp() {
        mediaService = new CloudinaryMediaService(
                cloudinary,
                "test-cloud",
                "test-key",
                "test-secret"
        );
    }

    @Test
    @DisplayName("Upload thumbnail thành công khi file hợp lệ")
    void uploadThumbnail_validFile_success() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "cover.jpg", "image/jpeg", new byte[]{1, 2, 3, 4}
        );
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), anyMap())).thenReturn(Map.of(
                "secure_url", "https://res.cloudinary.com/test-cloud/image/upload/nutribot/thumbnails/thumb_1_abc.jpg",
                "public_id", "nutribot/thumbnails/thumb_1_abc"
        ));

        CloudinaryMediaService.MediaUploadResult result = mediaService.uploadThumbnail(file, 1);

        assertNotNull(result);
        assertEquals("https://res.cloudinary.com/test-cloud/image/upload/nutribot/thumbnails/thumb_1_abc.jpg", result.secureUrl());
    }

    @Test
    @DisplayName("Từ chối upload khi file rỗng")
    void uploadThumbnail_emptyFile_throwsBadRequest() {
        MockMultipartFile file = new MockMultipartFile("file", "", "image/jpeg", new byte[0]);
        assertThrows(BadRequestException.class, () -> mediaService.uploadThumbnail(file, 1));
    }

    @Test
    @DisplayName("Từ chối upload khi file sai định dạng MIME")
    void uploadThumbnail_invalidMime_throwsBadRequest() {
        MockMultipartFile file = new MockMultipartFile("file", "script.exe", "application/octet-stream", new byte[]{1, 2, 3});
        assertThrows(BadRequestException.class, () -> mediaService.uploadThumbnail(file, 1));
    }

    @Test
    @DisplayName("Upload MP4 thành công với resource type video")
    void uploadVideo_validMp4_success() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "meal-prep.mp4", "video/mp4", new byte[]{1, 2, 3, 4}
        );
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), anyMap())).thenReturn(Map.of(
                "secure_url", "https://res.cloudinary.com/test-cloud/video/upload/nutribot/videos/video_1_abc.mp4",
                "public_id", "nutribot/videos/video_1_abc"
        ));

        CloudinaryMediaService.MediaUploadResult result = mediaService.uploadVideo(file, 1);

        assertEquals("https://res.cloudinary.com/test-cloud/video/upload/nutribot/videos/video_1_abc.mp4", result.secureUrl());
        verify(uploader).upload(any(byte[].class), argThat(options -> "video".equals(options.get("resource_type"))));
    }

    @Test
    @DisplayName("Từ chối video không phải MP4")
    void uploadVideo_nonMp4_throwsBadRequest() {
        MockMultipartFile file = new MockMultipartFile("file", "clip.mov", "video/quicktime", new byte[]{1});
        assertThrows(BadRequestException.class, () -> mediaService.uploadVideo(file, 1));
    }

    @Test
    @DisplayName("Xóa thumbnail an toàn theo URL")
    void deleteThumbnailByUrl_validUrl_callsCloudinaryDestroy() throws Exception {
        when(cloudinary.uploader()).thenReturn(uploader);
        String url = "https://res.cloudinary.com/test-cloud/image/upload/nutribot/thumbnails/thumb_1_abc.jpg";

        assertDoesNotThrow(() -> mediaService.deleteThumbnailByUrl(url));
        verify(uploader).destroy(eq("nutribot/thumbnails/thumb_1_abc"), anyMap());
    }

    @Test
    @DisplayName("Bỏ qua xóa an toàn khi URL không thuộc Cloudinary của hệ thống")
    void deleteThumbnailByUrl_externalUrl_ignoredSafely() {
        String externalUrl = "https://images.unsplash.com/photo-123456";
        assertDoesNotThrow(() -> mediaService.deleteThumbnailByUrl(externalUrl));
        verifyNoInteractions(cloudinary);
    }
}
