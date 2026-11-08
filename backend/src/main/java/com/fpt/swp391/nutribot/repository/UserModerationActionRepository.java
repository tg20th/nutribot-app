package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.UserModerationAction;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserModerationActionRepository extends JpaRepository<UserModerationAction, Long> {
    Page<UserModerationAction> findByUserIdOrderByCreatedAtDescActionIdDesc(Integer userId, Pageable pageable);
    Page<UserModerationAction> findByUserIdAndActionOrderByCreatedAtDescActionIdDesc(Integer userId, String action, Pageable pageable);
}
