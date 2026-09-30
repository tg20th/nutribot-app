package com.fpt.swp391.nutribot.repository.specification;

import com.fpt.swp391.nutribot.entity.Comment;
import com.fpt.swp391.nutribot.entity.User;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public class CommentSpecifications {

    public static Specification<Comment> withFilter(String keyword, String status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (keyword != null && !keyword.isBlank()) {
                String pattern = "%" + keyword.trim().toLowerCase() + "%";
                Predicate bodyMatch = cb.like(cb.lower(root.get("body")), pattern);

                Join<Comment, User> userJoin = root.join("user", JoinType.LEFT);
                Predicate usernameMatch = cb.like(cb.lower(userJoin.get("username")), pattern);
                Predicate emailMatch = cb.like(cb.lower(userJoin.get("email")), pattern);

                predicates.add(cb.or(bodyMatch, usernameMatch, emailMatch));
            }

            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("status")), status.trim().toLowerCase()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
