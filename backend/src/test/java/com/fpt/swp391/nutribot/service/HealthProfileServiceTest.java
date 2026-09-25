package com.fpt.swp391.nutribot.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class HealthProfileServiceTest {

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
}
