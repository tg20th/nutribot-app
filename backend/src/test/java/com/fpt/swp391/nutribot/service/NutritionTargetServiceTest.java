package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.NutritionTargetResponse;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NutritionTargetServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserProfileRepository userProfileRepository;

    @InjectMocks
    private NutritionTargetService nutritionTargetService;

    @Test
    @DisplayName("Tính target cho nam giới tăng cơ ăn chay thuần VEGAN: tăng đạm 10% và calo floor")
    void testCalculateTargetVeganGainMuscleMale() {
        String username = "vegan_user";
        User user = User.builder().userId(1).username(username).build();
        UserProfile profile = UserProfile.builder()
                .user(user)
                .userId(1)
                .gender("Male")
                .dateOfBirth(LocalDate.now().minusYears(25))
                .heightCm(new BigDecimal("175"))
                .weightKg(new BigDecimal("70"))
                .healthGoal("gain_muscle")
                .vegetarianType("VEGAN")
                .build();

        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));
        when(userProfileRepository.findById(1)).thenReturn(Optional.of(profile));

        NutritionTargetResponse target = nutritionTargetService.calculateTarget(username);

        assertThat(target).isNotNull();
        assertThat(target.calories()).isGreaterThanOrEqualTo(1500);
        // Với 70kg, gain_muscle = 1.8 * 1.10 = 1.98 -> 70 * 1.98 = 138.6 -> round = 139g
        assertThat(target.proteinG()).isEqualTo(139);
        assertThat(target.healthyFatsG()).isGreaterThan(0);
        assertThat(target.carbsG()).isGreaterThan(0);
    }

    @Test
    @DisplayName("Tính target cho nữ giới giảm cân áp dụng mức sàn an toàn calo floor 1200 kcal")
    void testCalculateTargetCalorieFloorFemale() {
        String username = "female_user";
        User user = User.builder().userId(2).username(username).build();
        // Bạn nữ 42kg, cao 1m50 -> BMR rất thấp, trừ 500 kcal thì TDEE rơi xuống < 1000 kcal
        UserProfile profile = UserProfile.builder()
                .user(user)
                .userId(2)
                .gender("Female")
                .dateOfBirth(LocalDate.now().minusYears(22))
                .heightCm(new BigDecimal("150"))
                .weightKg(new BigDecimal("42"))
                .healthGoal("lose_weight")
                .vegetarianType("LACTO_OVO")
                .build();

        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));
        when(userProfileRepository.findById(2)).thenReturn(Optional.of(profile));

        NutritionTargetResponse target = nutritionTargetService.calculateTarget(username);

        // Phải được chặn ở mức sàn an toàn 1200 kcal cho nữ
        assertThat(target.calories()).isEqualTo(1200);
        // Protein 42kg * 1.5 = 63g
        assertThat(target.proteinG()).isEqualTo(63);
        assertThat(target.healthyFatsG()).isGreaterThan(0);
        assertThat(target.carbsG()).isGreaterThan(0);
    }
}
