package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {

    @EntityGraph(attributePaths = "role")
    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    List<User> findByRoleRoleId(Integer roleId);

    boolean existsByUsernameAndUserIdNot(String username, Integer userId);

    boolean existsByEmailAndUserIdNot(String email, Integer userId);
}
