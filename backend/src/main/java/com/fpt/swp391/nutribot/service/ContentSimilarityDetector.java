package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Dịch vụ phát hiện độ tương đồng văn bản (Gần trùng lặp - Mức 2) giữa các bài viết (NB-97).
 * Sử dụng kỹ thuật N-Gram Shingling và Hệ số Tương đồng Jaccard.
 */
@Slf4j
@Service
public class ContentSimilarityDetector {

    public static final String FLAG_SUSPECTED_DUPLICATE = "SUSPECTED_DUPLICATE";
    public static final String FLAG_CLEAN = "CLEAN";

    private final ContentRepository contentRepository;
    private final double similarityThreshold;

    public ContentSimilarityDetector(
            ContentRepository contentRepository,
            @Value("${app.content.duplicate-similarity-threshold:0.80}") double similarityThreshold) {
        this.contentRepository = contentRepository;
        this.similarityThreshold = similarityThreshold;
    }

    @Getter
    @Builder
    public static class SimilarityResult {
        private final boolean suspected;
        private final double similarityScore;
        private final Content matchedContent;
        private final String matchedTitle;
        private final Integer matchedContentId;

        public static SimilarityResult clean() {
            return SimilarityResult.builder()
                    .suspected(false)
                    .similarityScore(0.0)
                    .build();
        }
    }

    /**
     * So sánh bài viết đang xét với các bài viết đã PUBLISHED cùng contentType.
     *
     * @param targetContent bài viết đang xét
     * @return kết quả đối soát độ tương đồng
     */
    public SimilarityResult detect(Content targetContent) {
        if (targetContent == null || targetContent.getBody() == null || targetContent.getBody().isBlank()) {
            return SimilarityResult.clean();
        }

        Integer excludeId = targetContent.getContentId() != null ? targetContent.getContentId() : -1;
        List<Content> publishedContents = contentRepository.findByContentTypeAndStatusAndContentIdNot(
                targetContent.getContentType(), "published", excludeId);

        if (publishedContents.isEmpty()) {
            return SimilarityResult.clean();
        }

        double highestScore = 0.0;
        Content bestMatch = null;

        for (Content candidate : publishedContents) {
            if (candidate.getBody() == null || candidate.getBody().isBlank()) {
                continue;
            }

            double score = calculateCompositeSimilarity(targetContent.getBody(), candidate.getBody());
            if (score > highestScore) {
                highestScore = score;
                bestMatch = candidate;
            }
        }

        // Làm tròn 2 chữ số thập phân (e.g. 0.85)
        double roundedScore = Math.round(highestScore * 100.0) / 100.0;
        log.debug("Đối soát tương đồng cho contentId={}: điểm cao nhất={}, ngưỡng={}",
                targetContent.getContentId(), roundedScore, similarityThreshold);

        if (roundedScore >= similarityThreshold && bestMatch != null) {
            return SimilarityResult.builder()
                    .suspected(true)
                    .similarityScore(roundedScore)
                    .matchedContent(bestMatch)
                    .matchedContentId(bestMatch.getContentId())
                    .matchedTitle(bestMatch.getTitle())
                    .build();
        }

        return SimilarityResult.clean();
    }

    /**
     * Tính toán tương đồng tổ hợp giữa 1-gram (từ vựng) và 2-gram (cụm từ liên tiếp).
     */
    public static double calculateCompositeSimilarity(String textA, String textB) {
        Set<String> wordsA = createShingles(textA, 1);
        Set<String> wordsB = createShingles(textB, 1);
        double wordScore = calculateJaccardSimilarity(wordsA, wordsB);

        Set<String> bigramsA = createShingles(textA, 2);
        Set<String> bigramsB = createShingles(textB, 2);
        double bigramScore = calculateJaccardSimilarity(bigramsA, bigramsB);

        if (bigramsA.isEmpty() || bigramsB.isEmpty()) {
            return wordScore;
        }
        return (0.4 * wordScore) + (0.6 * bigramScore);
    }

    /**
     * Tách văn bản thành tập hợp các N-Gram Shingles (mặc định n=3 từ liên tiếp).
     */
    public static Set<String> createShingles(String htmlContent, int n) {
        String plain = ContentTextNormalizer.extractPlainText(htmlContent);
        if (plain.isBlank()) {
            return Collections.emptySet();
        }

        String[] words = plain.split("\\s+");
        if (words.length == 0) {
            return Collections.emptySet();
        }

        Set<String> shingles = new HashSet<>();
        if (words.length < n) {
            // Nếu bài quá ngắn, lấy toàn bộ các từ đơn
            Collections.addAll(shingles, words);
            return shingles;
        }

        for (int i = 0; i <= words.length - n; i++) {
            StringBuilder sb = new StringBuilder();
            for (int j = 0; j < n; j++) {
                if (j > 0) sb.append(' ');
                sb.append(words[i + j]);
            }
            shingles.add(sb.toString());
        }
        return shingles;
    }

    /**
     * Tính hệ số tương đồng Jaccard giữa hai tập hợp shingles: |A ∩ B| / |A ∪ B|.
     */
    public static double calculateJaccardSimilarity(Set<String> setA, Set<String> setB) {
        if (setA == null || setB == null || setA.isEmpty() || setB.isEmpty()) {
            return 0.0;
        }

        int intersectionCount = 0;
        Set<String> smaller = setA.size() <= setB.size() ? setA : setB;
        Set<String> larger = setA.size() <= setB.size() ? setB : setA;

        for (String item : smaller) {
            if (larger.contains(item)) {
                intersectionCount++;
            }
        }

        int unionCount = setA.size() + setB.size() - intersectionCount;
        if (unionCount == 0) {
            return 0.0;
        }

        return (double) intersectionCount / unionCount;
    }
}
