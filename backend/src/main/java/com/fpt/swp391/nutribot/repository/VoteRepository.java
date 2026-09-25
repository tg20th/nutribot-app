package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Vote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VoteRepository extends JpaRepository<Vote, Integer> {

    Optional<Vote> findByUserIdAndContentId(Integer userId, Integer contentId);

    @Query("SELECT COUNT(v) FROM Vote v WHERE v.contentId = :contentId")
    Long countByContentId(@Param("contentId") Integer contentId);

    boolean existsByUserIdAndContentId(Integer userId, Integer contentId);

    @Modifying
    @Query("DELETE FROM Vote v WHERE v.userId = :userId AND v.contentId = :contentId")
    void deleteByUserIdAndContentId(@Param("userId") Integer userId, @Param("contentId") Integer contentId);
}
