package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.ContentModeration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ContentModerationRepository extends JpaRepository<ContentModeration, Integer> {

    Optional<ContentModeration> findByContentId(Integer contentId);

    List<ContentModeration> findByContentIdIn(Collection<Integer> contentIds);
}
