package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.IngredientCreateRequest;
import com.fpt.swp391.nutribot.dto.request.IngredientUpdateRequest;
import com.fpt.swp391.nutribot.entity.Category;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.CategoryRepository;
import com.fpt.swp391.nutribot.repository.IngredientRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AdminIngredientServiceTest {
    private IngredientRepository ingredientRepository;
    private CategoryRepository categoryRepository;
    private AdminIngredientService service;

    @BeforeEach
    void setUp() {
        ingredientRepository = mock(IngredientRepository.class);
        categoryRepository = mock(CategoryRepository.class);
        service = new AdminIngredientService(ingredientRepository, categoryRepository);
    }

    @Test
    void listPassesSearchAndStatusFiltersAndReturnsPagedResponse() {
        Ingredient ingredient = ingredient(7, "Yến mạch", "yen-mach", true);
        when(ingredientRepository.searchAdminIngredients(eq("yen"), eq(4), eq(false), any()))
                .thenReturn(new PageImpl<>(List.of(ingredient), PageRequest.of(0, 10), 1));

        var result = service.list(" yen ", 4, false, -1, 200);

        assertEquals(1, result.getTotalElements());
        assertEquals("Yến mạch", result.getContent().getFirst().name());
        verify(ingredientRepository).searchAdminIngredients(eq("yen"), eq(4), eq(false), any());
    }

    @Test
    void createTrimsFieldsAndRequiresActiveIngredientCategory() {
        when(categoryRepository.findById(4)).thenReturn(Optional.of(category("INGREDIENT", true)));
        when(ingredientRepository.save(any(Ingredient.class))).thenAnswer(invocation -> {
            Ingredient saved = invocation.getArgument(0);
            saved.setIngredientId(7);
            return saved;
        });

        var result = service.create(new IngredientCreateRequest(" Yến mạch ", " yen-mach ", " mô tả ", 4));

        assertEquals("Yến mạch", result.name());
        assertEquals("yen-mach", result.slug());
        assertEquals("mô tả", result.description());
        assertTrue(result.active());
    }

    @Test
    void createRejectsDuplicateNameOrSlug() {
        when(ingredientRepository.existsByNameIgnoreCase("Yến mạch")).thenReturn(true);
        assertThrows(BadRequestException.class, () -> service.create(
                new IngredientCreateRequest("Yến mạch", "yen-mach", null, 4)));
        verifyNoInteractions(categoryRepository);

        when(ingredientRepository.existsByNameIgnoreCase("Yến mạch")).thenReturn(false);
        when(ingredientRepository.existsBySlugIgnoreCase("yen-mach")).thenReturn(true);
        assertThrows(BadRequestException.class, () -> service.create(
                new IngredientCreateRequest("Yến mạch", "yen-mach", null, 4)));
    }

    @Test
    void createRejectsMissingWrongTypeOrInactiveCategory() {
        when(categoryRepository.findById(4)).thenReturn(Optional.empty());
        assertThrows(BadRequestException.class, () -> service.create(
                new IngredientCreateRequest("Yến mạch", "yen-mach", null, 4)));

        when(categoryRepository.findById(4)).thenReturn(Optional.of(category("RECIPE", true)));
        assertThrows(BadRequestException.class, () -> service.create(
                new IngredientCreateRequest("Yến mạch", "yen-mach", null, 4)));

        when(categoryRepository.findById(4)).thenReturn(Optional.of(category("INGREDIENT", false)));
        assertThrows(BadRequestException.class, () -> service.create(
                new IngredientCreateRequest("Yến mạch", "yen-mach", null, 4)));
    }

    @Test
    void updateAllowsExistingNameAndSlugButRejectsConflictsFromOtherRows() {
        Ingredient existing = ingredient(7, "Yến mạch", "yen-mach", true);
        when(ingredientRepository.findById(7)).thenReturn(Optional.of(existing));
        when(categoryRepository.findById(4)).thenReturn(Optional.of(category("INGREDIENT", true)));
        when(ingredientRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.update(7, new IngredientUpdateRequest(" Yến mạch ", " yen-mach ", null, 4));

        assertEquals(7, result.ingredientId());
        verify(ingredientRepository).existsByNameIgnoreCaseAndIngredientIdNot("Yến mạch", 7);
        verify(ingredientRepository).existsBySlugIgnoreCaseAndIngredientIdNot("yen-mach", 7);

        when(ingredientRepository.existsByNameIgnoreCaseAndIngredientIdNot("Tên khác", 7)).thenReturn(true);
        assertThrows(BadRequestException.class, () -> service.update(7,
                new IngredientUpdateRequest("Tên khác", "slug-khac", null, 4)));
    }

    @Test
    void deactivateAndReactivateOnlySaveStatusAndNeverDeleteReferences() {
        Ingredient existing = ingredient(7, "Yến mạch", "yen-mach", true);
        when(ingredientRepository.findById(7)).thenReturn(Optional.of(existing));
        when(ingredientRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        assertFalse(service.setActive(7, false).active());
        assertTrue(service.setActive(7, true).active());

        verify(ingredientRepository, times(2)).save(existing);
        verify(ingredientRepository, never()).delete(any(Ingredient.class));
        verifyNoInteractions(categoryRepository);
    }

    @Test
    void updateAndStatusReturnNotFoundForUnknownIngredient() {
        when(ingredientRepository.findById(999)).thenReturn(Optional.empty());
        assertThrows(NotFoundException.class, () -> service.update(999,
                new IngredientUpdateRequest("A", "a", null, 4)));
        assertThrows(NotFoundException.class, () -> service.setActive(999, false));
    }

    private Ingredient ingredient(int id, String name, String slug, boolean active) {
        return Ingredient.builder().ingredientId(id).name(name).slug(slug).categoryId(4).active(active).build();
    }

    private Category category(String type, boolean active) {
        return Category.builder().categoryId(4).categoryType(type).active(active).build();
    }
}
