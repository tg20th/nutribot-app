package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContentSimilarityDetectorTest {

    @Mock
    private ContentRepository contentRepository;

    private ContentSimilarityDetector detector;

    @BeforeEach
    void setUp() {
        detector = new ContentSimilarityDetector(contentRepository, 0.80);
    }

    @Test
    @DisplayName("Chuẩn hóa văn bản và băm SHA-256 chính xác")
    void contentTextNormalizer_extractAndHash() {
        String html = "<p>Cách nấu   <strong>Phở Nấm Chay</strong> thơm ngon!</p>";
        String plain = ContentTextNormalizer.extractPlainText(html);
        assertThat(plain).isEqualTo("cách nấu phở nấm chay thơm ngon");

        String hash1 = ContentTextNormalizer.computeContentHash(html);
        String hash2 = ContentTextNormalizer.computeContentHash("<p>cách nấu phở nấm chay thơm ngon!   </p>");
        assertThat(hash1).isNotEmpty().isEqualTo(hash2);
    }

    @Test
    @DisplayName("Phát hiện bài gần trùng (> 80%) và trả về thông tin bài gốc")
    void detect_highSimilarity_returnsSuspectedDuplicate() {
        Content original = Content.builder()
                .contentId(10)
                .contentType("BLOG")
                .title("Cách nấu phở nấm chay chuẩn vị")
                .body("<p>Hôm nay mình chia sẻ bí quyết nấu phở nấm chay thanh đạm, nước dùng ngọt từ củ cải và mía lau, nấm hương thơm lừng.</p>")
                .status("published")
                .build();

        // Bài mới sửa một vài từ
        Content candidate = Content.builder()
                .contentId(20)
                .contentType("BLOG")
                .title("Bí quyết nấu phở nấm chay thơm ngon")
                .body("<p>Hôm nay mình xin chia sẻ bí quyết nấu phở nấm chay thanh đạm, nước dùng ngọt tự nhiên từ củ cải và mía lau, nấm hương thơm lừng.</p>")
                .status("under_review")
                .build();

        when(contentRepository.findByContentTypeAndStatusAndContentIdNot(eq("BLOG"), eq("published"), eq(20)))
                .thenReturn(List.of(original));

        ContentSimilarityDetector.SimilarityResult result = detector.detect(candidate);

        assertThat(result.isSuspected()).isTrue();
        assertThat(result.getSimilarityScore()).isGreaterThanOrEqualTo(0.80);
        assertThat(result.getMatchedContentId()).isEqualTo(10);
        assertThat(result.getMatchedTitle()).isEqualTo("Cách nấu phở nấm chay chuẩn vị");
    }

    @Test
    @DisplayName("Bài khác biệt nội dung (< 80%) trả về CLEAN")
    void detect_lowSimilarity_returnsClean() {
        Content original = Content.builder()
                .contentId(10)
                .contentType("BLOG")
                .title("Cách làm gỏi cuốn chay")
                .body("<p>Gỏi cuốn chay với đậu hũ chiên giòn, bún tươi, rau sống và nước chấm tương bơ đậu phộng béo ngậy.</p>")
                .status("published")
                .build();

        Content candidate = Content.builder()
                .contentId(20)
                .contentType("BLOG")
                .title("Cách làm bún bò Huế chay")
                .body("<p>Bún bò Huế chay đậm đà với sả băm, ớt sa tế cay nồng, chả lụa chay và nấm đùi gà dai ngọt thanh mát.</p>")
                .status("under_review")
                .build();

        when(contentRepository.findByContentTypeAndStatusAndContentIdNot(eq("BLOG"), eq("published"), eq(20)))
                .thenReturn(List.of(original));

        ContentSimilarityDetector.SimilarityResult result = detector.detect(candidate);

        assertThat(result.isSuspected()).isFalse();
        assertThat(result.getMatchedContentId()).isNull();
    }
}
