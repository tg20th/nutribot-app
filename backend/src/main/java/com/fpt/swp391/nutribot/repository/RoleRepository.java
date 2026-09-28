package com.fpt.swp391.nutribot.repository;

import com.fpt.swp391.nutribot.entity.Role;
import com.fpt.swp391.nutribot.entity.RoleName;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RoleRepository extends JpaRepository<Role, Integer> {

    Optional<Role> findByRoleName(String roleName);

    Optional<Role> findByRoleNameIgnoreCase(String roleName);

    boolean existsByRoleName(String roleName);

    boolean existsByRoleNameIgnoreCase(String roleName);

    default Optional<Role> findByRoleEnum(RoleName roleEnum) {
        if (roleEnum == null) {
            return Optional.empty();
        }
        return findByRoleNameIgnoreCase(roleEnum.getAuthority())
                .or(() -> findByRoleNameIgnoreCase(roleEnum.name().replace("ROLE_", "")));
    }
}

