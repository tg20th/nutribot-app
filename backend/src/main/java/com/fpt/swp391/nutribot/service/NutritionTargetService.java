package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.NutritionTargetResponse;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.exception.NotFoundException;
import com.fpt.swp391.nutribot.exception.ProfileIncompleteException;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NutritionTargetService {

    private static final BigDecimal DEFAULT_ACTIVITY_FACTOR = new BigDecimal("1.2");

    private static final BigDecimal LOSS_FACTOR = new BigDecimal("-500");
    private static final BigDecimal MAINTAIN_FACTOR = BigDecimal.ZERO;
    private static final BigDecimal GAIN_FACTOR = new BigDecimal("300");

    private static final BigDecimal PROTEIN_FACTOR_LOSE = new BigDecimal("1.2");
    private static final BigDecimal PROTEIN_FACTOR_MAINTAIN = new BigDecimal("1.6");
    private static final BigDecimal PROTEIN_FACTOR_GAIN = new BigDecimal("2.0");

    private static final BigDecimal FAT_RATIO = new BigDecimal("0.25");
    private static final int FAT_CALORIES_PER_GRAM = 9;
    private static final int CARB_CALORIES_PER_GRAM = 4;
    private static final int PROTEIN_CALORIES_PER_GRAM = 4;

    private static final BigDecimal MALE_BMR_OFFSET = new BigDecimal("5");
    private static final BigDecimal FEMALE_BMR_OFFSET = new BigDecimal("-161");

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;

    @Transactional(readOnly = true)
    public NutritionTargetResponse calculateTarget(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));

        UserProfile profile = userProfileRepository.findById(user.getUserId()).orElse(null);

        List<String> missingFields = checkProfileCompleteness(profile);
        if (!missingFields.isEmpty()) {
            throw new ProfileIncompleteException(missingFields);
        }

        BigDecimal bmr = calculateBmr(profile);
        BigDecimal tdee = bmr.multiply(DEFAULT_ACTIVITY_FACTOR);
        BigDecimal calorieTarget = adjustForGoal(tdee, profile.getHealthGoal());
        int calories = calorieTarget.setScale(0, RoundingMode.HALF_UP).intValue();

        int proteinG = calculateProtein(profile.getWeightKg(), profile.getHealthGoal());
        int fatG = calculateFat(calories);
        int carbsG = calculateCarbs(calories, proteinG, fatG);

        return NutritionTargetResponse.builder()
                .estimated(true)
                .calories(calories)
                .proteinG(proteinG)
                .carbsG(carbsG)
                .healthyFatsG(fatG)
                .build();
    }

    public boolean isProfileComplete(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        UserProfile profile = userProfileRepository.findById(user.getUserId()).orElse(null);
        return checkProfileCompleteness(profile).isEmpty();
    }

    public List<String> getMissingFields(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        UserProfile profile = userProfileRepository.findById(user.getUserId()).orElse(null);
        return checkProfileCompleteness(profile);
    }

    private List<String> checkProfileCompleteness(UserProfile profile) {
        List<String> missing = new ArrayList<>();

        if (profile == null) {
            missing.add("heightCm");
            missing.add("weightKg");
            missing.add("dateOfBirth");
            missing.add("gender");
            missing.add("healthGoal");
            return missing;
        }

        if (profile.getHeightCm() == null || profile.getHeightCm().signum() <= 0) {
            missing.add("heightCm");
        }
        if (profile.getWeightKg() == null || profile.getWeightKg().signum() <= 0) {
            missing.add("weightKg");
        }
        if (profile.getDateOfBirth() == null) {
            missing.add("dateOfBirth");
        }
        if (profile.getGender() == null || profile.getGender().isBlank()) {
            missing.add("gender");
        }
        if (profile.getHealthGoal() == null || profile.getHealthGoal().isBlank()) {
            missing.add("healthGoal");
        }

        return missing;
    }

    private BigDecimal calculateBmr(UserProfile profile) {
        BigDecimal weight = profile.getWeightKg();
        BigDecimal height = profile.getHeightCm();
        int age = calculateAge(profile.getDateOfBirth());

        BigDecimal bmr = new BigDecimal("10")
                .multiply(weight)
                .add(new BigDecimal("6.25").multiply(height))
                .subtract(new BigDecimal("5").multiply(BigDecimal.valueOf(age)));

        return bmr.add(isMale(profile.getGender()) ? MALE_BMR_OFFSET : FEMALE_BMR_OFFSET);
    }

    private BigDecimal adjustForGoal(BigDecimal tdee, String healthGoal) {
        BigDecimal adjustment = switch (healthGoal) {
            case "lose_weight" -> LOSS_FACTOR;
            case "gain_muscle" -> GAIN_FACTOR;
            default -> MAINTAIN_FACTOR;
        };
        return tdee.add(adjustment);
    }

    private int calculateProtein(BigDecimal weightKg, String healthGoal) {
        BigDecimal factor = switch (healthGoal) {
            case "gain_muscle" -> PROTEIN_FACTOR_GAIN;
            case "lose_weight" -> PROTEIN_FACTOR_LOSE;
            default -> PROTEIN_FACTOR_MAINTAIN;
        };
        return weightKg.multiply(factor).setScale(0, RoundingMode.HALF_UP).intValue();
    }

    private int calculateFat(int calories) {
        return BigDecimal.valueOf(calories)
                .multiply(FAT_RATIO)
                .divide(BigDecimal.valueOf(FAT_CALORIES_PER_GRAM), 0, RoundingMode.HALF_UP)
                .intValue();
    }

    private int calculateCarbs(int calories, int proteinG, int fatG) {
        int proteinCalories = proteinG * PROTEIN_CALORIES_PER_GRAM;
        int fatCalories = fatG * FAT_CALORIES_PER_GRAM;
        int carbCalories = calories - proteinCalories - fatCalories;
        return Math.max(0, carbCalories / CARB_CALORIES_PER_GRAM);
    }

    private int calculateAge(LocalDate dateOfBirth) {
        return Period.between(dateOfBirth, LocalDate.now()).getYears();
    }

    private boolean isMale(String gender) {
        return "Male".equalsIgnoreCase(gender);
    }
}
