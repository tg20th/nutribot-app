package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.RecipeIngredientMapping;
import com.fpt.swp391.nutribot.entity.Category;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.repository.CategoryRepository;
import com.fpt.swp391.nutribot.repository.IngredientRepository;
import com.fpt.swp391.nutribot.service.RecipeExtractionGatewayService.IngredientProposal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecipeIngredientResolverTest {
    @Mock IngredientRepository ingredientRepository;
    @Mock CategoryRepository categoryRepository;
    @InjectMocks RecipeIngredientResolver resolver;

    private Ingredient ingredient(int id, String name, int categoryId) {
        return Ingredient.builder().ingredientId(id).name(name).categoryId(categoryId).active(true).build();
    }

    private Category category(int id, String type, boolean active) {
        return Category.builder().categoryId(id).categoryType(type).active(active).build();
    }

    private IngredientProposal proposal(String name) {
        return new IngredientProposal(name, BigDecimal.ONE, "g", null);
    }

    @Test
    void uniqueNormalizedMatchResolvesExistingCatalogId() {
        Ingredient catalog = ingredient(12, "Cà rốt", 4);
        when(ingredientRepository.findAllByActiveTrueOrderByNameAsc()).thenReturn(List.of(catalog));
        when(categoryRepository.findById(4)).thenReturn(Optional.of(category(4, "INGREDIENT", true)));

        var result = resolver.resolve(List.of(proposal(" ca   rot ")), null);

        assertTrue(result.issues().isEmpty());
        assertEquals(12, result.ingredients().get(0).getIngredientId());
    }

    @Test
    void unknownNameRequiresAdminMappingAndNeverCreatesIngredient() {
        Ingredient catalog = ingredient(12, "Cà rốt", 4);
        when(ingredientRepository.findAllByActiveTrueOrderByNameAsc()).thenReturn(List.of(catalog));

        var result = resolver.resolve(List.of(proposal("Bún gạo lứt")), null);

        assertEquals("INGREDIENT_MAPPING_REQUIRED", result.issues().get(0).getCode());
        assertNull(result.ingredients().get(0).getIngredientId());
    }

    @Test
    void ambiguousNormalizedNamesRequireExplicitSelection() {
        when(ingredientRepository.findAllByActiveTrueOrderByNameAsc()).thenReturn(List.of(
                ingredient(12, "Ca rot", 4), ingredient(13, "Cà-rốt", 4)));

        var result = resolver.resolve(List.of(proposal("Cà rốt")), null);

        assertEquals("INGREDIENT_MAPPING_AMBIGUOUS", result.issues().get(0).getCode());
    }

    @Test
    void selectedInactiveOrWrongCategoryIngredientIsRejected() {
        when(ingredientRepository.findAllByActiveTrueOrderByNameAsc()).thenReturn(List.of(ingredient(12, "Cà rốt", 4)));
        when(categoryRepository.findById(4)).thenReturn(Optional.of(category(4, "RECIPE", true)));

        var result = resolver.resolve(List.of(proposal("Unknown")), List.of(new RecipeIngredientMapping(0, 12)));

        assertTrue(result.issues().stream().anyMatch(issue -> "INGREDIENT_CATEGORY_INVALID".equals(issue.getCode())));
    }
}
