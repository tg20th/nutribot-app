package com.fpt.swp391.nutribot.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "content_recipe_suggestion_steps")
@IdClass(ContentRecipeSuggestionStepId.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContentRecipeSuggestionStep {

    @Id
    @Column(name = "suggestion_id")
    private Integer suggestionId;

    @Id
    @Column(name = "step_number")
    private Integer stepNumber;

    @Column(name = "instruction", nullable = false, columnDefinition = "NVARCHAR(MAX)")
    private String instruction;

    @Column(name = "duration_min")
    private Integer durationMin;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "suggestion_id", insertable = false, updatable = false)
    private ContentRecipeSuggestion suggestion;
}
