package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.ContentViewEvent;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;

public interface ContentViewEventRepository extends JpaRepository<ContentViewEvent, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from ContentViewEvent e where e.userId=:userId and e.contentId=:contentId and e.endedAt is null order by e.startedAt desc")
    List<ContentViewEvent> findActiveForUpdate(@Param("userId") Integer userId, @Param("contentId") Integer contentId);

    List<ContentViewEvent> findTop1000ByUserIdOrderByLastActiveAtDesc(Integer userId);
}
