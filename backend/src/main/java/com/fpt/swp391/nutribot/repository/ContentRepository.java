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

    Page<Content> findByContentTypeAndStatusAndUserUserId(String contentType, String status, Integer userId, Pageable pageable);

    Optional<Content> findBySlug(String slug);

    Optional<Content> findByContentIdAndContentType(Integer contentId, String contentType);

    @Query("SELECT c FROM Content c WHERE c.contentId = :contentId AND c.contentType = :contentType")
    Optional<Content> findByContentIdAndType(@Param("contentId") Integer contentId, @Param("contentType") String contentType);

    Optional<Content> findByContentIdAndUserUserId(Integer contentId, Integer userId);

    Page<Content> findByUserUserId(Integer userId, Pageable pageable);

    Page<Content> findByUserUserIdAndContentType(Integer userId, String contentType, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.contentType = :contentType AND c.status = :status ORDER BY c.viewCount DESC, c.createdAt DESC")
    List<Content> findPublishedByTypeWithLimit(@Param("contentType") String contentType, @Param("status") String status, Pageable pageable);

    Long countByContentTypeAndStatus(String contentType, String status);

    // Search queries
    @Query("SELECT c FROM Content c WHERE c.status = :status AND " +
           "(LOWER(c.title) LIKE :keyword OR LOWER(c.body) LIKE :keyword) " +
           "ORDER BY c.createdAt DESC")
    Page<Content> searchByKeyword(@Param("keyword") String keyword, @Param("status") String status, Pageable pageable);

    @Query("SELECT c FROM Content c WHERE c.status = :status AND c.contentType = :contentType AND " +
           "(LOWER(c.title) LIKE :keyword OR LOWER(c.body) LIKE :keyword) " +
           "ORDER BY c.createdAt DESC")
    Page<Content> searchByKeywordAndType(@Param("keyword") String keyword, @Param("contentType") String contentType,
                                          @Param("status") String status, Pageable pageable);

    Page<Content> findByStatus(String status, Pageable pageable);

    @Modifying
    @Query("UPDATE Content c SET c.viewCount = c.viewCount + 1 WHERE c.contentId = :contentId")
    void incrementViewCount(@Param("contentId") Integer contentId);
}
