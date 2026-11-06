package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.ContentRecipeDto;
import com.fpt.swp391.nutribot.entity.Content;
import com.fpt.swp391.nutribot.entity.ContentRecipeDetail;
import com.fpt.swp391.nutribot.entity.ContentRecipeIngredient;
import com.fpt.swp391.nutribot.entity.ContentRecipeStep;
import com.fpt.swp391.nutribot.repository.ContentRecipeDetailRepository;
import com.fpt.swp391.nutribot.repository.ContentRecipeIngredientRepository;
import com.fpt.swp391.nutribot.repository.ContentRecipeStepRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@Service
@RequiredArgsConstructor
public class ContentRecipePersistenceService {
    private final ContentRecipeDetailRepository details;
    private final ContentRecipeIngredientRepository ingredients;
    private final ContentRecipeStepRepository steps;
    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void replace(Content content, ContentRecipeDto recipe) {
        Integer contentId = content.getContentId();
        if (contentId == null) throw new IllegalStateException("Content phải được persist trước khi lưu recipe details");
        ingredients.deleteByContentId(contentId);
        steps.deleteByContentId(contentId);
        boolean hasDetails = recipe.getPrepMinutes() != null || recipe.getCookMinutes() != null || recipe.getServings() != null
                || recipe.getCalories() != null || recipe.getProteinG() != null || recipe.getCarbsG() != null
                || recipe.getFatG() != null || recipe.getFiberG() != null || recipe.getSodiumMg() != null;
        ContentRecipeDetail detail = details.findById(contentId).orElse(null);
        if (hasDetails) {
            if (detail == null) { detail = new ContentRecipeDetail(); detail.setContentId(contentId); }
            detail.setContent(content); detail.setContentId(contentId);
            detail.setPrepMinutes(recipe.getPrepMinutes()); detail.setCookMinutes(recipe.getCookMinutes());
            detail.setServings(recipe.getServings()); detail.setCalories(recipe.getCalories());
            detail.setProteinG(recipe.getProteinG()); detail.setCarbsG(recipe.getCarbsG());
            detail.setFatG(recipe.getFatG()); detail.setFiberG(recipe.getFiberG()); detail.setSodiumMg(recipe.getSodiumMg());
            if (!entityManager.contains(detail)) {
                // New @MapsId entity: persist explicitly. Calling repository.save() after
                // assigning contentId makes SimpleJpaRepository.isNew() return false.
                entityManager.persist(detail);
            }
        } else if (detail != null) details.delete(detail);
        if (recipe.getIngredients() != null) for (int n = 0; n < recipe.getIngredients().size(); n++) {
            var value = recipe.getIngredients().get(n);
            if (value != null && value.getName() != null && !value.getName().isBlank()) ingredients.save(ContentRecipeIngredient.builder()
                    .contentId(contentId).sortOrder(n + 1).ingredientName(value.getName().trim()).quantity(value.getQuantity())
                    .unit(value.getUnit()).isCustom(Boolean.TRUE.equals(value.getIsCustom())).build());
        }
        if (recipe.getSteps() != null) for (int n = 0; n < recipe.getSteps().size(); n++) {
            var value = recipe.getSteps().get(n);
            if (value != null && value.getInstruction() != null && !value.getInstruction().isBlank()) steps.save(ContentRecipeStep.builder()
                    .contentId(contentId).stepNumber(n + 1).instruction(value.getInstruction().trim()).build());
        }
    }

    @Transactional(readOnly = true)
    public ContentRecipeDto read(Integer contentId) {
        var detail = details.findById(contentId).orElse(null);
        var ingredientValues = ingredients.findByContentIdOrderBySortOrderAsc(contentId).stream().map(value -> ContentRecipeDto.Ingredient.builder()
                .name(value.getIngredientName()).quantity(value.getQuantity()).unit(value.getUnit()).isCustom(value.getIsCustom()).build()).toList();
        var stepValues = steps.findByContentIdOrderByStepNumberAsc(contentId).stream().map(value -> ContentRecipeDto.Step.builder()
                .instruction(value.getInstruction()).build()).toList();
        if (detail == null && ingredientValues.isEmpty() && stepValues.isEmpty()) return null;
        return ContentRecipeDto.builder().prepMinutes(detail == null ? null : detail.getPrepMinutes()).cookMinutes(detail == null ? null : detail.getCookMinutes())
                .servings(detail == null ? null : detail.getServings()).calories(detail == null ? null : detail.getCalories())
                .proteinG(detail == null ? null : detail.getProteinG()).carbsG(detail == null ? null : detail.getCarbsG())
                .fatG(detail == null ? null : detail.getFatG()).fiberG(detail == null ? null : detail.getFiberG())
                .sodiumMg(detail == null ? null : detail.getSodiumMg()).ingredients(ingredientValues).steps(stepValues).build();
    }
}
