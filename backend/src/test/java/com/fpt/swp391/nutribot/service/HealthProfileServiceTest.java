package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.request.HealthProfileUpdateRequest;
import com.fpt.swp391.nutribot.entity.Ingredient;
import com.fpt.swp391.nutribot.entity.User;
import com.fpt.swp391.nutribot.entity.UserAllergy;
import com.fpt.swp391.nutribot.entity.UserProfile;
import com.fpt.swp391.nutribot.exception.BadRequestException;
import com.fpt.swp391.nutribot.repository.IngredientRepository;
import com.fpt.swp391.nutribot.repository.UserProfileRepository;
import com.fpt.swp391.nutribot.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HealthProfileServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private UserProfileRepository userProfileRepository;
    @Mock
    private IngredientRepository ingredientRepository;
    @InjectMocks
    private HealthProfileService service;


    @Test
    void tinhBmiVaPhanLoaiBinhThuong() {
        BigDecimal bmi = HealthProfileService.calculateBmi(
                new BigDecimal("168"), new BigDecimal("58"));

        assertThat(bmi).isEqualByComparingTo("20.5");
        assertThat(HealthProfileService.categorizeBmi(bmi)).isEqualTo("Bình thường");
    }

    @Test
    void traVeRongKhiThieuChiSoCoThe() {
        assertThat(HealthProfileService.calculateBmi(null, new BigDecimal("58"))).isNull();
        assertThat(HealthProfileService.categorizeBmi(null)).isNull();
    }

    @Test
    void updateHealthProfile_giuNguyenAllergyInactiveDaLuuVaChoPhepCapNhatProfile() {
        User user = User.builder().userId(7).username("alice").build();
        Ingredient inactive = Ingredient.builder().ingredientId(5).name("Peanut").active(false).build();
        UserProfile profile = UserProfile.builder().user(user).build();
        profile.getAllergies().add(UserAllergy.builder()
                .userProfile(profile).userId(7).ingredientId(5).ingredient(inactive).build());
        HealthProfileUpdateRequest request = new HealthProfileUpdateRequest();
        request.setHeightCm(new BigDecimal("170"));
        request.setAllergyIngredientIds(List.of(5));

        when(userRepository.findByUsernameForUpdate("alice")).thenReturn(Optional.of(user));
        when(userProfileRepository.findById(7)).thenReturn(Optional.of(profile));
        when(ingredientRepository.findAllById(anyCollection())).thenReturn(List.of(inactive));
        when(userProfileRepository.save(any(UserProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.updateHealthProfile("alice", request);

        assertThat(response.heightCm()).isEqualByComparingTo("170");
        assertThat(response.allergyIngredientIds()).containsExactly(5);
        assertThat(response.allergies()).containsExactly("Peanut");
        verify(userProfileRepository).save(profile);
    }

    @Test
    void updateHealthProfile_tuChoiAllergyMoiNeuIngredientInactive() {
        User user = User.builder().userId(7).username("alice").build();
        Ingredient inactive = Ingredient.builder().ingredientId(5).name("Peanut").active(false).build();
        UserProfile profile = UserProfile.builder().user(user).build();
        HealthProfileUpdateRequest request = new HealthProfileUpdateRequest();
        request.setAllergyIngredientIds(List.of(5));

        when(userRepository.findByUsernameForUpdate("alice")).thenReturn(Optional.of(user));
        when(userProfileRepository.findById(7)).thenReturn(Optional.of(profile));
        when(ingredientRepository.findAllById(anyCollection())).thenReturn(List.of(inactive));

        assertThatThrownBy(() -> service.updateHealthProfile("alice", request))
                .isInstanceOf(BadRequestException.class);
        verify(userProfileRepository, never()).save(any(UserProfile.class));
    }
}
