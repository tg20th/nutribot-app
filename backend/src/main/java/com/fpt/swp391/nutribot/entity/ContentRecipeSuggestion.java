package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "content_recipe_suggestions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContentRecipeSuggestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "suggestion_id")
    private Integer suggestionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "content_id", nullable = false)
    private Content content;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "dish_id")
    private Integer dishId;

    @Column(name = "recipe_id")
    private Integer recipeId;

    @Column(name = "source_view_count")
    private Integer sourceViewCount;

    @Column(name = "source_vote_count")
    private Integer sourceVoteCount;

    @Column(name = "dish_name", length = 150)
    private String dishName;

    @Column(name = "dish_description", columnDefinition = "NVARCHAR(MAX)")
    private String dishDescription;

    @Column(name = "serving_size", precision = 8, scale = 2)
    private BigDecimal servingSize;

    @Column(name = "serving_unit", length = 30)
    private String servingUnit;

    @Column(name = "calories")
    private Integer calories;

    @Column(name = "protein_g", precision = 6, scale = 2)
    private BigDecimal proteinG;

    @Column(name = "carbs_g", precision = 6, scale = 2)
    private BigDecimal carbsG;

    @Column(name = "fat_g", precision = 6, scale = 2)
    private BigDecimal fatG;

    @Column(name = "fiber_g", precision = 6, scale = 2)
    private BigDecimal fiberG;

    @Column(name = "ingredients_json", columnDefinition = "NVARCHAR(MAX)")
    private String ingredientsJson;

    @Column(name = "recipe_title", length = 200)
    private String recipeTitle;

    @Column(name = "recipe_description", columnDefinition = "NVARCHAR(MAX)")
    private String recipeDescription;

    @Column(name = "prep_time_min")
    private Integer prepTimeMin;

    @Column(name = "cook_time_min")
    private Integer cookTimeMin;

    @Column(name = "servings")
    private Integer servings;

    @Column(name = "recipe_steps_json", columnDefinition = "NVARCHAR(MAX)")
    private String recipeStepsJson;

    @Column(name = "restaurant_name", length = 200)
    private String restaurantName;

    @Column(name = "restaurant_address", length = 300)
    private String restaurantAddress;

    @Column(name = "restaurant_reference", length = 500)
    private String restaurantReference;

    @Column(name = "reviewed_by")
    private Integer reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "rejection_reason", columnDefinition = "NVARCHAR(MAX)")
    private String rejectionReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (status == null) status = "PENDING";
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
