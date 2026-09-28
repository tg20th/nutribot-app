package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.AccountStatus;
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

    @EntityGraph(attributePaths = "role")
    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByUsername(String username);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<User> findByRoleRoleId(Integer roleId);

    List<User> findByStatus(AccountStatus status);

    boolean existsByUsernameAndUserIdNot(String username, Integer userId);

    boolean existsByUsernameIgnoreCaseAndUserIdNot(String username, Integer userId);

    boolean existsByEmailAndUserIdNot(String email, Integer userId);

    boolean existsByEmailIgnoreCaseAndUserIdNot(String email, Integer userId);

    default Optional<User> findByNormalizedUsername(String username) {
        if (username == null || username.isBlank()) {
            return Optional.empty();
        }
        return findByUsernameIgnoreCase(username.trim());
    }

    default Optional<User> findByNormalizedEmail(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        return findByEmailIgnoreCase(email.trim().toLowerCase());
    }

    default boolean existsByNormalizedUsername(String username) {
        if (username == null || username.isBlank()) {
            return false;
        }
        return existsByUsernameIgnoreCase(username.trim());
    }

    default boolean existsByNormalizedEmail(String email) {
        if (email == null || email.isBlank()) {
            return false;
        }
        return existsByEmailIgnoreCase(email.trim().toLowerCase());
    }

    default Optional<User> findByNormalizedUsernameOrEmail(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return Optional.empty();
        }
        String clean = identifier.trim();
        return findByUsernameIgnoreCase(clean)
                .or(() -> findByEmailIgnoreCase(clean.toLowerCase()));
    }
}
