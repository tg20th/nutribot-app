package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.dto.response.CommunityHighlightResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContentRepository extends JpaRepository<Content, Integer> {

    Page<Content> findByContentTypeAndStatus(String contentType, String status, Pageable pageable);

    Page<Content> findByContentTypeAndStatusAndCategoryId(String contentType, String status, Integer categoryId, Pageable pageable);

    Page<Content> findByStatusAndCategoryId(String status, Integer categoryId, Pageable pageable);

    Page<Content> findByContentTypeAndStatusAndUserUserId(String contentType, String status, Integer userId, Pageable pageable);

    Long countByContentTypeAndStatusAndUserUserId(String contentType, String status, Integer userId);

    Optional<Content> findBySlug(String slug);

    boolean existsBySlug(String slug);

    Optional<Content> findByContentIdAndContentType(Integer contentId, String contentType);

    @Query("SELECT c FROM Content c WHERE c.contentId = :contentId AND c.contentType = :contentType")
    Optional<Content> findByContentIdAndType(@Param("contentId") Integer contentId, @Param("contentType") String contentType);

    @Query("SELECT c FROM Content c WHERE c.slug = :slug AND c.contentType = :contentType AND c.status = :status AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN)")
    Optional<Content> findPublishedBySlugAndType(
            @Param("slug") String slug,
            @Param("contentType") String contentType,
            @Param("status") String status);

    @Query("SELECT c FROM Content c WHERE c.contentId = :contentId AND c.contentType = :contentType AND c.status = :status AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN)")
    Optional<Content> findPublishedByIdAndType(
            @Param("contentId") Integer contentId,
            @Param("contentType") String contentType,
            @Param("status") String status);

    @Query("SELECT c FROM Content c WHERE c.contentId = :contentId AND c.status = :status AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN)")
    Optional<Content> findPublishedById(
            @Param("contentId") Integer contentId,
            @Param("status") String status);

    // NB-61: revalidate nội dung nguồn còn published khi Admin duyệt đề xuất.
    // Không phụ thuộc trạng thái tác giả để nhất quán với điều kiện sinh đề xuất (NB-60).
    Optional<Content> findByContentIdAndStatus(Integer contentId, String status);

    Optional<Content> findByContentIdAndUserUserId(Integer contentId, Integer userId);

    Page<Content> findByUserUserId(Integer userId, Pageable pageable);

    Page<Content> findByUserUserIdAndContentType(Integer userId, String contentType, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.contentType = :contentType AND c.status = :status AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN) ORDER BY c.viewCount DESC, c.createdAt DESC, c.contentId DESC")
    List<Content> findPublishedByTypeWithLimit(@Param("contentType") String contentType, @Param("status") String status, Pageable pageable);

    @Query("SELECT COUNT(c) FROM Content c WHERE c.contentType = :contentType AND c.status = :status AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN)")
    Long countPublishedByTypeAndActiveAuthor(@Param("contentType") String contentType, @Param("status") String status);

    Long countByContentTypeAndStatus(String contentType, String status);

    // Search queries with dynamic sorting and active author visibility
    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN) AND " +
           "(LOWER(c.title) LIKE :keyword OR LOWER(c.body) LIKE :keyword)")
    Page<Content> searchByKeyword(@Param("keyword") String keyword, @Param("status") String status, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.contentType = :contentType AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN) AND " +
           "(LOWER(c.title) LIKE :keyword OR LOWER(c.body) LIKE :keyword)")
    Page<Content> searchByKeywordAndType(@Param("keyword") String keyword, @Param("contentType") String contentType,
                                          @Param("status") String status, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.categoryId = :categoryId AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN) AND " +
           "(LOWER(c.title) LIKE :keyword OR LOWER(c.body) LIKE :keyword)")
    Page<Content> searchByKeywordAndCategory(@Param("keyword") String keyword, @Param("categoryId") Integer categoryId,
                                             @Param("status") String status, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.contentType = :contentType AND c.categoryId = :categoryId AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN) AND " +
           "(LOWER(c.title) LIKE :keyword OR LOWER(c.body) LIKE :keyword)")
    Page<Content> searchByKeywordAndTypeAndCategory(@Param("keyword") String keyword, @Param("contentType") String contentType,
                                                     @Param("categoryId") Integer categoryId, @Param("status") String status,
                                                     Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.contentType = :contentType AND c.categoryId = :categoryId AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN)")
    Page<Content> findPublishedByTypeAndCategory(@Param("contentType") String contentType, @Param("categoryId") Integer categoryId, @Param("status") String status, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.contentType = :contentType AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN)")
    Page<Content> findPublishedByType(@Param("contentType") String contentType, @Param("status") String status, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.categoryId = :categoryId AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN)")
    Page<Content> findPublishedByCategory(@Param("categoryId") Integer categoryId, @Param("status") String status, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN)")
    Page<Content> findPublishedAll(@Param("status") String status, Pageable pageable);

    Page<Content> findByStatus(String status, Pageable pageable);

    // NB-83: Khoá dòng content để serialize việc tạo/gộp notification theo cùng 1 bài viết.
    // Tránh race khi nhiều user vote/comment đồng thời sinh ra nhiều notification trùng nhóm.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Content c WHERE c.contentId = :contentId")
    Optional<Content> findByIdForUpdate(@Param("contentId") Integer contentId);

    // NB-60: nội dung published đủ ngưỡng view để rà soát tạo recipe suggestion
    List<Content> findByStatusAndViewCountGreaterThanEqual(String status, Integer viewCount);

    @Query("SELECT c FROM Content c WHERE c.status IN :statuses")
    Page<Content> findByStatusIn(@Param("statuses") List<String> statuses, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status IN :statuses AND LOWER(c.contentType) = LOWER(:contentType)")
    Page<Content> findByStatusInAndContentType(
            @Param("statuses") List<String> statuses,
            @Param("contentType") String contentType,
            Pageable pageable);

    @Modifying
    @Query("UPDATE Content c SET c.viewCount = c.viewCount + 1 WHERE c.contentId = :contentId")
    void incrementViewCount(@Param("contentId") Integer contentId);

    // NB-59: Lấy nội dung liên quan (cùng type + category, trừ bài hiện tại)
    @Query("SELECT c FROM Content c WHERE c.contentType = :contentType AND c.status = :status " +
           "AND c.categoryId = :categoryId AND c.contentId <> :excludeId " +
           "AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN) " +
           "ORDER BY c.viewCount DESC, c.createdAt DESC, c.contentId DESC")
    List<Content> findRelatedByTypeAndCategory(
            @Param("contentType") String contentType,
            @Param("categoryId") Integer categoryId,
            @Param("excludeId") Integer excludeId,
            @Param("status") String status,
            Pageable pageable);

    // NB-59: Fallback – cùng type nhưng khác category (khi không đủ bài cùng category)
    @Query("SELECT c FROM Content c WHERE c.contentType = :contentType AND c.status = :status " +
           "AND c.contentId <> :excludeId " +
           "AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN) " +
           "ORDER BY c.viewCount DESC, c.createdAt DESC, c.contentId DESC")
    List<Content> findRelatedByType(
            @Param("contentType") String contentType,
            @Param("excludeId") Integer excludeId,
            @Param("status") String status,
            Pageable pageable);

    // NB-65: Catalog cho AI recommender - tất cả public content
    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN)")
    List<Content> findPublicCatalogForRecommendation(@Param("status") String status, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.contentId IN :contentIds AND c.status = :status " +
           "AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN)")
    List<Content> findPublicByIds(@Param("contentIds") List<Integer> contentIds, @Param("status") String status);

    // NB-65: Đếm vote cho content
    @Query("SELECT COUNT(v) FROM Vote v WHERE v.contentId = :contentId AND v.voteValue = 1")
    Long countVoteByContentId(@Param("contentId") Integer contentId);

    @Query("SELECT new com.fpt.swp391.nutribot.dto.response.CommunityHighlightResponse(" +
           "c.contentId, c.contentType, c.title, c.thumbnailUrl, " +
           "c.user.userId, c.user.username, c.user.fullName, c.user.avatarUrl, " +
           "(SELECT COUNT(v) FROM Vote v WHERE v.contentId = c.contentId AND v.voteValue = 1), " +
           "(SELECT COUNT(cm) FROM Comment cm WHERE cm.contentId = c.contentId AND cm.status = 'published'), " +
           "c.createdAt) " +
           "FROM Content c " +
           "WHERE c.status = :status " +
           "AND c.contentType IN ('BLOG', 'VIDEO') " +
           "AND c.user.status IN (com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE, com.fpt.swp391.nutribot.entity.AccountStatus.WARN) " +
           "ORDER BY " +
           "((SELECT COUNT(v2) FROM Vote v2 WHERE v2.contentId = c.contentId AND v2.voteValue = 1) * 3 + " +
           "(SELECT COUNT(cm2) FROM Comment cm2 WHERE cm2.contentId = c.contentId AND cm2.status = 'published') * 2) DESC, " +
           "c.createdAt DESC, c.contentId DESC")
    List<CommunityHighlightResponse> findCommunityHighlights(
            @Param("status") String status,
            Pageable pageable);
}
