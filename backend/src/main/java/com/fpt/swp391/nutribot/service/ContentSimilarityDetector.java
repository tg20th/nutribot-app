package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.repository.ContentRepository;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Dịch vụ phát hiện độ tương đồng văn bản (Gần trùng lặp - Mức 2) giữa các bài viết (NB-97).
 * Sử dụng kỹ thuật N-Gram Shingling, Hệ số Tương đồng Jaccard, Tỷ lệ Bao hàm (Containment),
 * và Thuật toán Khối từ liên tiếp trùng lặp dài nhất (Longest Common Contiguous Word Block)
 * nhằm chống lại kỹ thuật pha loãng văn bản (Anti-Dilution).
 */
@Slf4j
@Service
public class ContentSimilarityDetector {

    public static final String FLAG_SUSPECTED_DUPLICATE = "SUSPECTED_DUPLICATE";
    public static final String FLAG_CLEAN = "CLEAN";

    private final ContentRepository contentRepository;
    private final ContentRecipePersistenceService recipePersistenceService;
    private final double similarityThreshold;
    private final int matchingBlockThreshold;

    @Autowired
    public ContentSimilarityDetector(
            ContentRepository contentRepository,
            @Autowired(required = false) ContentRecipePersistenceService recipePersistenceService,
            @Value("${app.content.duplicate-similarity-threshold:0.80}") double similarityThreshold,
            @Value("${app.content.duplicate-block-threshold:25}") int matchingBlockThreshold) {
        this.contentRepository = contentRepository;
        this.recipePersistenceService = recipePersistenceService;
        this.similarityThreshold = similarityThreshold;
        this.matchingBlockThreshold = matchingBlockThreshold;
    }

    public ContentSimilarityDetector(ContentRepository contentRepository, double similarityThreshold) {
        this(contentRepository, null, similarityThreshold, 25);
    }

    public ContentSimilarityDetector(ContentRepository contentRepository, ContentRecipePersistenceService recipePersistenceService, double similarityThreshold) {
        this(contentRepository, recipePersistenceService, similarityThreshold, 25);
    }

    @Getter
    @Builder
    public static class SimilarityResult {
        private final boolean suspected;
        private final double similarityScore;
        private final Content matchedContent;
        private final String matchedTitle;
        private final Integer matchedContentId;
        private final int longestMatchingBlock;

        public static SimilarityResult clean() {
            return SimilarityResult.builder()
                    .suspected(false)
                    .similarityScore(0.0)
                    .longestMatchingBlock(0)
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
        String targetText = resolveFullSearchableText(targetContent);
        if (targetText.isBlank()) {
            return SimilarityResult.clean();
        }

        Integer excludeId = targetContent.getContentId() != null ? targetContent.getContentId() : -1;
        List<Content> publishedContents = contentRepository.findByContentTypeAndStatusAndContentIdNot(
                targetContent.getContentType(), "published", excludeId);

        if (publishedContents.isEmpty()) {
            return SimilarityResult.clean();
        }

        double highestScore = 0.0;
        int maxMatchingBlock = 0;
        Content bestMatch = null;

        for (Content candidate : publishedContents) {
            String candidateText = resolveFullSearchableText(candidate);
            if (candidateText.isBlank()) {
                continue;
            }

            double score = calculateCompositeSimilarity(targetText, candidateText);
            int matchingBlock = findLongestContiguousMatchingWords(targetText, candidateText);

            boolean isSuspectedByBlock = matchingBlockThreshold > 0 && matchingBlock >= matchingBlockThreshold;
            boolean isSuspectedByScore = score >= similarityThreshold;

            if (isSuspectedByBlock || isSuspectedByScore) {
                // Nếu bị phát hiện bởi khối từ liên tiếp dài, gán điểm hiệu dụng tối thiểu 0.85
                double effectiveScore = isSuspectedByBlock ? Math.max(score, 0.85) : score;
                if (effectiveScore > highestScore) {
                    highestScore = effectiveScore;
                    maxMatchingBlock = matchingBlock;
                    bestMatch = candidate;
                }
            } else if (score > highestScore && bestMatch == null) {
                highestScore = score;
                maxMatchingBlock = matchingBlock;
            }
        }

        // Làm tròn 2 chữ số thập phân (e.g. 0.85)
        double roundedScore = Math.round(highestScore * 100.0) / 100.0;
        log.debug("Đối soát tương đồng cho contentId={}: điểm cao nhất={}, block={}, ngưỡng={}",
                targetContent.getContentId(), roundedScore, maxMatchingBlock, similarityThreshold);

        if ((roundedScore >= similarityThreshold || (matchingBlockThreshold > 0 && maxMatchingBlock >= matchingBlockThreshold))
                && bestMatch != null) {
            return SimilarityResult.builder()
                    .suspected(true)
                    .similarityScore(roundedScore)
                    .matchedContent(bestMatch)
                    .matchedContentId(bestMatch.getContentId())
                    .matchedTitle(bestMatch.getTitle())
                    .longestMatchingBlock(maxMatchingBlock)
                    .build();
        }

        return SimilarityResult.clean();
    }

    /**
     * Bóc tách toàn bộ chuỗi văn bản của bài viết, tự động gộp cả nguyên liệu và các bước
     * nấu ăn nếu bài viết có cấu trúc Recipe đi kèm (NB-97).
     *
     * @param content bài viết cần xử lý
     * @return chuỗi văn bản gộp đã chuẩn hóa
     */
    public String resolveFullSearchableText(Content content) {
        if (content == null) {
            return "";
        }
        String body = content.getBody() != null ? content.getBody() : "";
        if (recipePersistenceService == null || content.getContentId() == null) {
            return body;
        }
        try {
            var recipe = recipePersistenceService.read(content.getContentId());
            return ContentTextNormalizer.buildSearchableText(body, recipe);
        } catch (Exception e) {
            log.debug("Không thể đọc công thức cho contentId {}: {}", content.getContentId(), e.getMessage());
            return body;
        }
    }

    /**
     * Tính toán tương đồng tổ hợp giữa 1-gram (từ vựng) và 2-gram (cụm từ liên tiếp),
     * kết hợp cả Hệ số Jaccard và Tỷ lệ Bao hàm (Containment) để chống pha loãng văn bản.
     */
    public static double calculateCompositeSimilarity(String textA, String textB) {
        Set<String> wordsA = createShingles(textA, 1);
        Set<String> wordsB = createShingles(textB, 1);
        double wordScore = calculateJaccardSimilarity(wordsA, wordsB);
        double containmentWord = calculateContainmentSimilarity(wordsA, wordsB);

        Set<String> bigramsA = createShingles(textA, 2);
        Set<String> bigramsB = createShingles(textB, 2);
        double bigramScore = calculateJaccardSimilarity(bigramsA, bigramsB);
        double containmentBigram = calculateContainmentSimilarity(bigramsA, bigramsB);

        double jaccardScore = (bigramsA.isEmpty() || bigramsB.isEmpty())
                ? wordScore
                : (0.4 * wordScore) + (0.6 * bigramScore);

        double containmentScore = (bigramsA.isEmpty() || bigramsB.isEmpty())
                ? containmentWord
                : (0.4 * containmentWord) + (0.6 * containmentBigram);

        // Chiết khấu 0.90 cho Containment để tránh phạt nhầm các bài viết ngắn có chung nguyên liệu cơ bản
        return Math.max(jaccardScore, containmentScore * 0.90);
    }

    /**
     * Tìm số lượng từ liên tiếp trùng khớp 100% dài nhất giữa hai văn bản
     * (Longest Common Contiguous Word Block).
     */
    public static int findLongestContiguousMatchingWords(String textA, String textB) {
        String plainA = ContentTextNormalizer.extractPlainText(textA);
        String plainB = ContentTextNormalizer.extractPlainText(textB);
        if (plainA.isBlank() || plainB.isBlank()) {
            return 0;
        }

        String[] wordsA = plainA.split("\\s+");
        String[] wordsB = plainB.split("\\s+");
        if (wordsA.length == 0 || wordsB.length == 0) {
            return 0;
        }

        // Quy hoạch động 1 chiều: O(wordsA.length * wordsB.length), không gian O(wordsB.length)
        int[] dp = new int[wordsB.length + 1];
        int maxLen = 0;

        for (int i = 1; i <= wordsA.length; i++) {
            for (int j = wordsB.length; j >= 1; j--) {
                if (wordsA[i - 1].equals(wordsB[j - 1])) {
                    dp[j] = dp[j - 1] + 1;
                    if (dp[j] > maxLen) {
                        maxLen = dp[j];
                    }
                } else {
                    dp[j] = 0;
                }
            }
        }

        return maxLen;
    }

    /**
     * Tách văn bản thành tập hợp các N-Gram Shingles.
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
     * Tính hệ số tương đồng Jaccard: |A ∩ B| / |A ∪ B|.
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

    /**
     * Tính Tỷ lệ Bao hàm (Containment / Coverage): |A ∩ B| / min(|A|, |B|).
     * Đo lường xem văn bản nhỏ hơn có nằm gọn trong văn bản lớn hơn hay không.
     */
    public static double calculateContainmentSimilarity(Set<String> setA, Set<String> setB) {
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

        int minSize = Math.min(setA.size(), setB.size());
        if (minSize == 0) {
            return 0.0;
        }

        return (double) intersectionCount / minSize;
    }
}
