package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.AccountStatus;
import com.fpt.swp391.nutribot.entity.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface UserRepository extends JpaRepository<User, Integer>, JpaSpecificationExecutor<User> {

    @Override
    @EntityGraph(attributePaths = "role")
    Page<User> findAll(Specification<User> spec, Pageable pageable);

    @Query("select count(u) from User u where (upper(u.role.roleName) = 'ADMIN' or upper(u.role.roleName) = 'ROLE_ADMIN') and u.status = :status")
    long countActiveAdmins(@Param("status") AccountStatus status);

    @EntityGraph(attributePaths = "role")
    Optional<User> findByUsername(String username);

    @EntityGraph(attributePaths = "role")
    Optional<User> findByUsernameIgnoreCase(String username);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.username = :username")
    Optional<User> findByUsernameForUpdate(@Param("username") String username);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.userId = :userId")
    Optional<User> findByIdForUpdate(@Param("userId") Integer userId);

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
