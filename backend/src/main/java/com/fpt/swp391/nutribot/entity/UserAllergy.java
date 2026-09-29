package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_allergies",
        uniqueConstraints = @UniqueConstraint(
                name = "PK_user_allergies",
                columnNames = {"user_id", "ingredient_id"}
        ))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserAllergy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "allergy_id")
    private Integer allergyId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserProfile userProfile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;
}
