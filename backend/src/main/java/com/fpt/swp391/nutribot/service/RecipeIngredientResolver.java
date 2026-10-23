package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.RecipeIngredientMapping;
import com.fpt.swp391.nutribot.dto.response.RecipeValidationIssue;
import com.fpt.swp391.nutribot.dto.response.ResolvedRecipeIngredient;
import com.fpt.swp391.nutribot.entity.Category;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.repository.CategoryRepository;
import com.fpt.swp391.nutribot.repository.IngredientRepository;
import com.fpt.swp391.nutribot.service.RecipeExtractionGatewayService.IngredientProposal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;

import static com.fpt.swp391.nutribot.dto.response.RecipeValidationIssue.SEVERITY_ERROR;

@Component
@RequiredArgsConstructor
public class RecipeIngredientResolver {
    private final IngredientRepository ingredientRepository;
    private final CategoryRepository categoryRepository;

    public Resolution resolve(List<IngredientProposal> proposals, List<RecipeIngredientMapping> requestedMappings) {
        List<RecipeValidationIssue> issues = new ArrayList<>();
        if (proposals == null) return new Resolution(List.of(), issues);
        List<Ingredient> active = ingredientRepository.findAllByActiveTrueOrderByNameAsc();
        Map<Integer, Ingredient> requested = new HashMap<>();
        Set<Integer> seenIds = new HashSet<>();
        Set<Integer> seenIndexes = new HashSet<>();
        if (requestedMappings != null) {
            for (RecipeIngredientMapping mapping : requestedMappings) {
                if (mapping == null || mapping.getProposalIndex() == null || mapping.getIngredientId() == null
                        || mapping.getProposalIndex() < 0 || mapping.getProposalIndex() >= proposals.size()
                        || !seenIndexes.add(mapping.getProposalIndex())) {
                    issue(issues, "ingredients", "INGREDIENT_MAPPING_INVALID", "Mapping nguyên liệu không hợp lệ hoặc bị lặp");
                    continue;
                }
                Ingredient selected = active.stream().filter(i -> mapping.getIngredientId().equals(i.getIngredientId()))
                        .findFirst().orElse(null);
                if (selected == null) {
                    issue(issues, "ingredients[" + mapping.getProposalIndex() + "]", "INGREDIENT_MAPPING_INVALID",
                            "Nguyên liệu được chọn không tồn tại hoặc đã bị vô hiệu hóa");
                    continue;
                }
                Category category = categoryRepository.findById(selected.getCategoryId()).orElse(null);
                if (category == null || !Boolean.TRUE.equals(category.getActive())
                        || !"INGREDIENT".equalsIgnoreCase(category.getCategoryType())) {
                    issue(issues, "ingredients[" + mapping.getProposalIndex() + "]", "INGREDIENT_CATEGORY_INVALID",
                            "Nguyên liệu được chọn không thuộc danh mục nguyên liệu đang hoạt động");
                    continue;
                }
                if (!seenIds.add(selected.getIngredientId())) {
                    issue(issues, "ingredients[" + mapping.getProposalIndex() + "]", "INGREDIENT_MAPPING_DUPLICATED",
                            "Nhiều nguyên liệu đề xuất không thể cùng ánh xạ tới một nguyên liệu catalog");
                    continue;
                }
                requested.put(mapping.getProposalIndex(), selected);
            }
        }

        List<ResolvedRecipeIngredient> resolved = new ArrayList<>();
        Set<Integer> mappedIds = new HashSet<>();
        for (int index = 0; index < proposals.size(); index++) {
            IngredientProposal proposal = proposals.get(index);
            if (proposal == null || proposal.name() == null || proposal.name().isBlank()) continue;
            List<Ingredient> matches = active.stream()
                    .filter(i -> RecipeTextNormalizer.normalizeIngredientCatalogName(i.getName())
                            .equals(RecipeTextNormalizer.normalizeIngredientCatalogName(proposal.name())))
                    .toList();
            Ingredient ingredient = requested.get(index);
            String status;
            if (ingredient != null) status = "ADMIN_SELECTED";
            else if (matches.size() == 1) {
                ingredient = matches.get(0);
                Category category = categoryRepository.findById(ingredient.getCategoryId()).orElse(null);
                if (category != null && Boolean.TRUE.equals(category.getActive())
                        && "INGREDIENT".equalsIgnoreCase(category.getCategoryType())) status = "MATCHED";
                else {
                    status = "INVALID_CATEGORY";
                    issue(issues, "ingredients[" + index + "]", "INGREDIENT_CATEGORY_INVALID",
                            "Nguyên liệu catalog không thuộc danh mục nguyên liệu đang hoạt động");
                    ingredient = null;
                }
            } else if (matches.isEmpty()) {
                status = "UNRESOLVED";
                issue(issues, "ingredients[" + index + "]", "INGREDIENT_MAPPING_REQUIRED",
                        "Không tìm thấy nguyên liệu phù hợp trong catalog; Admin cần chọn nguyên liệu có sẵn");
            } else {
                status = "AMBIGUOUS";
                issue(issues, "ingredients[" + index + "]", "INGREDIENT_MAPPING_AMBIGUOUS",
                        "Có nhiều nguyên liệu trùng tên sau chuẩn hóa; Admin cần chọn nguyên liệu phù hợp");
            }
            if (ingredient != null && !mappedIds.add(ingredient.getIngredientId())) {
                status = "DUPLICATED";
                issue(issues, "ingredients[" + index + "]", "INGREDIENT_MAPPING_DUPLICATED",
                        "Nhiều nguyên liệu đề xuất ánh xạ tới cùng một nguyên liệu catalog");
            }
            resolved.add(ResolvedRecipeIngredient.builder().proposalIndex(index).proposedName(proposal.name())
                    .ingredientId(ingredient == null ? null : ingredient.getIngredientId())
                    .ingredientName(ingredient == null ? null : ingredient.getName()).status(status).build());
        }
        return new Resolution(List.copyOf(resolved), List.copyOf(issues));
    }

    private static void issue(List<RecipeValidationIssue> issues, String field, String code, String message) {
        issues.add(RecipeValidationIssue.builder().field(field).code(code).severity(SEVERITY_ERROR).message(message).build());
    }

    public record Resolution(List<ResolvedRecipeIngredient> ingredients, List<RecipeValidationIssue> issues) {
    }
}
