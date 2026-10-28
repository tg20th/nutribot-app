package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class RecipeStepId implements Serializable {

    @Column(name = "recipe_id")
    private Integer recipeId;

    @Column(name = "step_number")
    private Integer stepNumber;
}
