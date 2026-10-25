package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.IngredientCreateRequest;
import com.fpt.swp391.nutribot.dto.request.IngredientUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.AdminIngredientResponse;
import com.fpt.swp391.nutribot.dto.response.PagedResponse;
import com.fpt.swp391.nutribot.entity.Category;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.CategoryRepository;
import com.fpt.swp391.nutribot.repository.IngredientRepository;
import com.fpt.swp391.nutribot.repository.IngredientReferenceSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminIngredientService {
    private static final String INGREDIENT_CATEGORY = "INGREDIENT";
    private static final int MAX_PAGE_SIZE = 100;

    private final IngredientRepository ingredientRepository;
    private final CategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public PagedResponse<AdminIngredientResponse> list(String keyword, Integer categoryId,
                                                       Boolean active, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = size <= 0 ? 10 : Math.min(size, MAX_PAGE_SIZE);
        String normalizedKeyword = keyword == null || keyword.isBlank() ? null : keyword.trim();
        var results = ingredientRepository.searchAdminIngredients(
                        normalizedKeyword, categoryId, active,
                        PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.ASC, "name", "ingredientId")));
        var ids = results.getContent().stream().map(Ingredient::getIngredientId).toList();
        Map<Integer, IngredientReferenceSummary> references = ids.isEmpty() ? Map.of()
                : referenceSummaries(ids).stream()
                .collect(Collectors.toMap(IngredientReferenceSummary::getIngredientId, Function.identity()));
        return PagedResponse.of(results.map(ingredient -> toResponse(ingredient, references.get(ingredient.getIngredientId()))));
    }

    @Transactional
    public AdminIngredientResponse create(IngredientCreateRequest request) {
        String name = request.getName().trim();
        String slug = request.getSlug().trim();
        ensureUnique(name, slug, null);
        validateIngredientCategory(request.getCategoryId());

        Ingredient ingredient = Ingredient.builder()
                .name(name)
                .slug(slug)
                .description(trimToNull(request.getDescription()))
                .categoryId(request.getCategoryId())
                .active(true)
                .build();
        return toResponse(ingredientRepository.save(ingredient));
    }

    @Transactional
    public AdminIngredientResponse update(Integer ingredientId, IngredientUpdateRequest request) {
        Ingredient ingredient = findIngredient(ingredientId);
        String name = request.getName().trim();
        String slug = request.getSlug().trim();
        ensureUnique(name, slug, ingredientId);
        validateIngredientCategory(request.getCategoryId());

        boolean identityChanged = !ingredient.getName().equals(name)
                || !ingredient.getSlug().equals(slug)
                || !ingredient.getCategoryId().equals(request.getCategoryId());
        if (identityChanged && hasReferences(ingredientId)) {
            throw new BadRequestException("This ingredient is referenced by saved allergies or recipes. Create a new ingredient and deactivate this one instead of changing its identity.");
        }

        ingredient.setName(name);
        ingredient.setSlug(slug);
        ingredient.setDescription(trimToNull(request.getDescription()));
        ingredient.setCategoryId(request.getCategoryId());
        return toResponse(ingredientRepository.save(ingredient));
    }

    @Transactional
    public AdminIngredientResponse setActive(Integer ingredientId, boolean active) {
        Ingredient ingredient = findIngredient(ingredientId);
        ingredient.setActive(active);
        return toResponse(ingredientRepository.save(ingredient));
    }

    private Ingredient findIngredient(Integer ingredientId) {
        return ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new NotFoundException("Ingredient not found."));
    }

    private void ensureUnique(String name, String slug, Integer excludedId) {
        boolean duplicateName = excludedId == null
                ? ingredientRepository.existsByNameIgnoreCase(name)
                : ingredientRepository.existsByNameIgnoreCaseAndIngredientIdNot(name, excludedId);
        boolean duplicateSlug = excludedId == null
                ? ingredientRepository.existsBySlugIgnoreCase(slug)
                : ingredientRepository.existsBySlugIgnoreCaseAndIngredientIdNot(slug, excludedId);
        if (duplicateName) throw new BadRequestException("An ingredient with this name already exists.");
        if (duplicateSlug) throw new BadRequestException("An ingredient with this slug already exists.");
    }

    private void validateIngredientCategory(Integer categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new BadRequestException("Ingredient category was not found."));
        if (!INGREDIENT_CATEGORY.equalsIgnoreCase(category.getCategoryType())
                || !Boolean.TRUE.equals(category.getActive())) {
            throw new BadRequestException("Category must be active and have type INGREDIENT.");
        }
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private boolean hasReferences(Integer ingredientId) {
        return referenceSummaries(java.util.List.of(ingredientId)).stream()
                .anyMatch(summary -> summary.getAllergyReferenceCount() > 0 || summary.getRecipeReferenceCount() > 0);
    }

    private AdminIngredientResponse toResponse(Ingredient ingredient, IngredientReferenceSummary references) {
        return AdminIngredientResponse.builder()
                .ingredientId(ingredient.getIngredientId())
                .name(ingredient.getName())
                .slug(ingredient.getSlug())
                .description(ingredient.getDescription())
                .categoryId(ingredient.getCategoryId())
                .active(ingredient.getActive())
                .createdAt(ingredient.getCreatedAt())
                .allergyReferenceCount(references == null ? 0L : references.getAllergyReferenceCount())
                .recipeReferenceCount(references == null ? 0L : references.getRecipeReferenceCount())
                .build();
    }

    private AdminIngredientResponse toResponse(Ingredient ingredient) {
        return toResponse(ingredient, referenceSummaries(
                java.util.List.of(ingredient.getIngredientId())).stream().findFirst().orElse(null));
    }

    private java.util.List<IngredientReferenceSummary> referenceSummaries(java.util.Collection<Integer> ids) {
        java.util.List<IngredientReferenceSummary> summaries = ingredientRepository.findReferenceSummaries(ids);
        return summaries == null ? java.util.List.of() : summaries;
    }
}
