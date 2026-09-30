package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class UserAllergyId implements Serializable {

    @Column(name = "user_id")
    private Integer userId;

    @Column(name = "ingredient_id")
    private Integer ingredientId;
}
