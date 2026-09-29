package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_allergies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@IdClass(UserAllergyId.class)
public class UserAllergy {

    @Id
    @Column(name = "user_id")
    private Integer userId;

    @Id
    @Column(name = "ingredient_id")
    private Integer ingredientId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private UserProfile userProfile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ingredient_id", insertable = false, updatable = false)
    private Ingredient ingredient;
}
