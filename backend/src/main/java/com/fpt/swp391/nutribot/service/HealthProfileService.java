package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.HealthProfileUpdateRequest;
import com.fpt.swp391.nutribot.dto.response.HealthProfileResponse;
import com.fpt.swp391.nutribot.dto.response.IngredientOptionResponse;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.repository.IngredientRepository;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class HealthProfileService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final IngredientRepository ingredientRepository;

    @Transactional(readOnly = true)
    public HealthProfileResponse getHealthProfile(String username) {
        User user = findUser(username);
        UserProfile profile = userProfileRepository.findById(user.getUserId()).orElse(null);
        return toResponse(profile);
    }

    @Transactional(readOnly = true)
    public List<IngredientOptionResponse> getActiveIngredients() {
        return ingredientRepository.findAllByActiveTrueOrderByNameAsc().stream()
                .map(ingredient -> IngredientOptionResponse.builder()
                        .ingredientId(ingredient.getIngredientId())
                        .name(ingredient.getName())
                        .slug(ingredient.getSlug())
                        .categoryId(ingredient.getCategoryId())
                        .build())
                .toList();
    }

    @Transactional
    public HealthProfileResponse updateHealthProfile(String username, HealthProfileUpdateRequest request) {
        User user = findUser(username);
        UserProfile profile = userProfileRepository.findById(user.getUserId())
                .orElseGet(() -> UserProfile.builder().user(user).build());

        Set<Integer> requestedIds = new LinkedHashSet<>(
                request.getAllergyIngredientIds() == null ? List.of() : request.getAllergyIngredientIds());
        List<Ingredient> ingredients = requestedIds.isEmpty()
                ? List.of()
                : ingredientRepository.findAllByIngredientIdInAndActiveTrue(requestedIds);

        if (ingredients.size() != requestedIds.size()) {
            throw new BadRequestException("Danh sách nguyên liệu dị ứng chứa lựa chọn không hợp lệ");
        }

        profile.setUser(user);
        profile.setHeightCm(request.getHeightCm());
        profile.setWeightKg(request.getWeightKg());
        profile.setHealthGoal(request.getHealthGoal());
        profile.setAllergies(new HashSet<>(ingredients));

        return toResponse(userProfileRepository.save(profile));
    }

    static BigDecimal calculateBmi(BigDecimal heightCm, BigDecimal weightKg) {
        if (heightCm == null || weightKg == null || heightCm.signum() <= 0 || weightKg.signum() <= 0) {
            return null;
        }
        BigDecimal heightMeters = heightCm.movePointLeft(2);
        return weightKg.divide(heightMeters.multiply(heightMeters), 1, RoundingMode.HALF_UP);
    }

    static String categorizeBmi(BigDecimal bmi) {
        if (bmi == null) return null;
        if (bmi.compareTo(new BigDecimal("18.5")) < 0) return "Thiếu cân";
        if (bmi.compareTo(new BigDecimal("25.0")) < 0) return "Bình thường";
        if (bmi.compareTo(new BigDecimal("30.0")) < 0) return "Thừa cân";
        return "Béo phì";
    }

    private User findUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
    }

    private HealthProfileResponse toResponse(UserProfile profile) {
        BigDecimal bmi = profile == null ? null : calculateBmi(profile.getHeightCm(), profile.getWeightKg());
        List<Ingredient> allergies = profile == null
                ? List.of()
                : profile.getAllergies().stream().sorted((left, right) -> left.getName().compareToIgnoreCase(right.getName())).toList();

        return HealthProfileResponse.builder()
                .heightCm(profile == null ? null : profile.getHeightCm())
                .weightKg(profile == null ? null : profile.getWeightKg())
                .bmi(bmi)
                .bmiCategory(categorizeBmi(bmi))
                .healthGoal(profile == null ? null : profile.getHealthGoal())
                .allergyIngredientIds(allergies.stream().map(Ingredient::getIngredientId).toList())
                .allergies(allergies.stream().map(Ingredient::getName).toList())
                .build();
    }
}
