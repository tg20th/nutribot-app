package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Content;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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

    @Modifying
    @Query("UPDATE Content c SET c.viewCount = c.viewCount + 1 WHERE c.contentId = :contentId")
    void incrementViewCount(@Param("contentId") Integer contentId);
}
