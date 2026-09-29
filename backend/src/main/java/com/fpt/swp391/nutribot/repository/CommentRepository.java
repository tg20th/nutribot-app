package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Comment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Integer> {

    Page<Comment> findByContentIdAndStatus(Integer contentId, String status, Pageable pageable);

    Page<Comment> findByContentIdAndParentIdIsNullAndStatus(Integer contentId, String status, Pageable pageable);

    List<Comment> findByParentId(Integer parentId);

    List<Comment> findByParentIdAndStatus(Integer parentId, String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Comment c WHERE c.commentId = :commentId")
    Optional<Comment> findByIdForUpdate(@Param("commentId") Integer commentId);

    @Query("SELECT COUNT(c) FROM Comment c WHERE c.contentId = :contentId AND c.status = :status")
    Long countByContentIdAndStatus(@Param("contentId") Integer contentId, @Param("status") String status);
}
