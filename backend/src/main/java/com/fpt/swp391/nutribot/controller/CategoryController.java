package com.fpt.swp391.nutribot.controller;

import com.fpt.swp391.nutribot.dto.request.CategoryCreateRequest;
import com.fpt.swp391.nutribot.dto.request.CategoryUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.ApiResponse;
import com.fpt.swp391.nutribot.dto.response.CategoryResponse;
import com.fpt.swp391.nutribot.entity.Category;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.CategoryRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryRepository categoryRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CategoryResponse>>> getCategories(
            @RequestParam(required = false) String type,
            Authentication authentication) {
        String normalizedType = type == null || type.isBlank() ? null : type.trim().toUpperCase();
        boolean activeOnly = !isAdmin(authentication);
        List<CategoryResponse> response = categoryRepository.findCategories(normalizedType, activeOnly).stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(ApiResponse.success("Lấy danh mục thành công", response));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CategoryResponse>> createCategory(
            @Valid @RequestBody CategoryCreateRequest request) {
        String categoryName = request.getCategoryName().trim();
        String slug = request.getSlug().trim();

        if (categoryRepository.existsByCategoryNameIgnoreCase(categoryName)) {
            throw new BadRequestException("A category with this name already exists.");
        }
        if (categoryRepository.existsBySlugIgnoreCase(slug)) {
            throw new BadRequestException("A category with this slug already exists.");
        }

        Category category = Category.builder()
                .categoryName(categoryName)
                .slug(slug)
                .description(request.getDescription())
                .categoryType(request.getCategoryType().trim().toUpperCase())
                .active(true)
                .createdAt(LocalDateTime.now(ZoneOffset.UTC))
                .build();

        Category savedCategory = categoryRepository.save(category);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Category created successfully.", toResponse(savedCategory)));
    }

    @PutMapping("/{categoryId}")
    public ResponseEntity<ApiResponse<CategoryResponse>> updateCategory(
            @PathVariable Integer categoryId,
            @Valid @RequestBody CategoryUpdateRequest request) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));

        String categoryName = request.getCategoryName().trim();
        String slug = request.getSlug().trim();

        if (categoryRepository.existsByCategoryNameIgnoreCaseAndCategoryIdNot(categoryName, categoryId)) {
            throw new BadRequestException("A category with this name already exists.");
        }
        if (categoryRepository.existsBySlugIgnoreCaseAndCategoryIdNot(slug, categoryId)) {
            throw new BadRequestException("A category with this slug already exists.");
        }

        category.setCategoryName(categoryName);
        category.setSlug(slug);
        category.setDescription(request.getDescription());
        category.setCategoryType(request.getCategoryType().trim().toUpperCase());
        if (request.getActive() != null) {
            category.setActive(request.getActive());
        }

        Category savedCategory = categoryRepository.save(category);
        return ResponseEntity.ok(ApiResponse.success("Category updated successfully.", toResponse(savedCategory)));
    }

    @DeleteMapping("/{categoryId}")
    public ResponseEntity<ApiResponse<CategoryResponse>> deactivateCategory(@PathVariable Integer categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found."));

        category.setActive(false);
        Category savedCategory = categoryRepository.save(category);
        return ResponseEntity.ok(ApiResponse.success("Category deactivated successfully.", toResponse(savedCategory)));
    }

    private boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private CategoryResponse toResponse(Category category) {
        return CategoryResponse.builder()
                .categoryId(category.getCategoryId())
                .categoryName(category.getCategoryName())
                .slug(category.getSlug())
                .iconUrl(category.getIconUrl())
                .contentCount(0L)
                .categoryType(category.getCategoryType())
                .description(category.getDescription())
                .active(category.getActive())
                .build();
    }
}
