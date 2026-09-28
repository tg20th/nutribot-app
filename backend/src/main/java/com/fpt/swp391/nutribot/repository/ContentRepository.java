package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Content;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContentRepository extends JpaRepository<Content, Integer> {

    Page<Content> findByContentTypeAndStatus(String contentType, String status, Pageable pageable);

    Page<Content> findByContentTypeAndStatusAndCategoryId(String contentType, String status, Integer categoryId, Pageable pageable);

    Page<Content> findByStatusAndCategoryId(String status, Integer categoryId, Pageable pageable);

    Page<Content> findByContentTypeAndStatusAndUserUserId(String contentType, String status, Integer userId, Pageable pageable);

    Optional<Content> findBySlug(String slug);

    Optional<Content> findByContentIdAndContentType(Integer contentId, String contentType);

    @Query("SELECT c FROM Content c WHERE c.contentId = :contentId AND c.contentType = :contentType")
    Optional<Content> findByContentIdAndType(@Param("contentId") Integer contentId, @Param("contentType") String contentType);

    @Query("SELECT c FROM Content c WHERE c.slug = :slug AND c.contentType = :contentType AND c.status = :status AND c.user.status = com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE")
    Optional<Content> findPublishedBySlugAndType(
            @Param("slug") String slug,
            @Param("contentType") String contentType,
            @Param("status") String status);

    @Query("SELECT c FROM Content c WHERE c.contentId = :contentId AND c.contentType = :contentType AND c.status = :status AND c.user.status = com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE")
    Optional<Content> findPublishedByIdAndType(
            @Param("contentId") Integer contentId,
            @Param("contentType") String contentType,
            @Param("status") String status);

    Optional<Content> findByContentIdAndUserUserId(Integer contentId, Integer userId);

    Page<Content> findByUserUserId(Integer userId, Pageable pageable);

    Page<Content> findByUserUserIdAndContentType(Integer userId, String contentType, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.contentType = :contentType AND c.status = :status AND c.user.status = com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE ORDER BY c.viewCount DESC, c.createdAt DESC, c.contentId DESC")
    List<Content> findPublishedByTypeWithLimit(@Param("contentType") String contentType, @Param("status") String status, Pageable pageable);

    @Query("SELECT COUNT(c) FROM Content c WHERE c.contentType = :contentType AND c.status = :status AND c.user.status = com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE")
    Long countPublishedByTypeAndActiveAuthor(@Param("contentType") String contentType, @Param("status") String status);

    Long countByContentTypeAndStatus(String contentType, String status);

    // Search queries with dynamic sorting and active author visibility
    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.user.status = com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE AND " +
           "(LOWER(c.title) LIKE :keyword OR LOWER(c.body) LIKE :keyword)")
    Page<Content> searchByKeyword(@Param("keyword") String keyword, @Param("status") String status, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.contentType = :contentType AND c.user.status = com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE AND " +
           "(LOWER(c.title) LIKE :keyword OR LOWER(c.body) LIKE :keyword)")
    Page<Content> searchByKeywordAndType(@Param("keyword") String keyword, @Param("contentType") String contentType,
                                          @Param("status") String status, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.categoryId = :categoryId AND c.user.status = com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE AND " +
           "(LOWER(c.title) LIKE :keyword OR LOWER(c.body) LIKE :keyword)")
    Page<Content> searchByKeywordAndCategory(@Param("keyword") String keyword, @Param("categoryId") Integer categoryId,
                                             @Param("status") String status, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.contentType = :contentType AND c.categoryId = :categoryId AND c.user.status = com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE AND " +
           "(LOWER(c.title) LIKE :keyword OR LOWER(c.body) LIKE :keyword)")
    Page<Content> searchByKeywordAndTypeAndCategory(@Param("keyword") String keyword, @Param("contentType") String contentType,
                                                     @Param("categoryId") Integer categoryId, @Param("status") String status,
                                                     Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.contentType = :contentType AND c.categoryId = :categoryId AND c.user.status = com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE")
    Page<Content> findPublishedByTypeAndCategory(@Param("contentType") String contentType, @Param("categoryId") Integer categoryId, @Param("status") String status, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.contentType = :contentType AND c.user.status = com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE")
    Page<Content> findPublishedByType(@Param("contentType") String contentType, @Param("status") String status, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.categoryId = :categoryId AND c.user.status = com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE")
    Page<Content> findPublishedByCategory(@Param("categoryId") Integer categoryId, @Param("status") String status, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.user.status = com.fpt.swp391.nutribot.entity.AccountStatus.ACTIVE")
    Page<Content> findPublishedAll(@Param("status") String status, Pageable pageable);

    Page<Content> findByStatus(String status, Pageable pageable);

    @Modifying
    @Query("UPDATE Content c SET c.viewCount = c.viewCount + 1 WHERE c.contentId = :contentId")
    void incrementViewCount(@Param("contentId") Integer contentId);
}
