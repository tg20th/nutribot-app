package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.HealthProfileResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ChatbotIntentRouterTest {
    private final ChatbotIntentRouter router = new ChatbotIntentRouter();
    private final HealthProfileResponse profile = HealthProfileResponse.builder()
            .bmi(new BigDecimal("21.4")).bmiCategory("Bình thường")
            .allergies(List.of("Đậu phộng")).healthGoal("lose_weight")
            .vegetarianType("VEGAN").build();

    @Test
    void routes_member_own_bmi_read_without_ai() {
        assertThat(router.route("BMI của tôi là bao nhiêu?", profile, false))
                .hasValueSatisfying(reply -> assertThat(reply).contains("21.4"));
    }

    @Test
    void never_routes_guest_profile_request() {
        assertThat(router.route("Dị ứng của tôi là gì?", profile, true)).isEmpty();
    }

    @Test
    void routes_simple_greeting_but_leaves_advice_to_ai() {
        assertThat(router.route("Xin chào", null, true)).isPresent();
        assertThat(router.route("Tôi nên ăn gì để giảm cân?", profile, false)).isEmpty();
    }

    @Test
    void classifies_ten_consecutive_mixed_turns_without_routing_advice_as_profile_reads() {
        Map<String, Boolean> cases = Map.ofEntries(
                Map.entry("Xin chào", true),
                Map.entry("Cảm ơn bạn", true),
                Map.entry("BMI của tôi là bao nhiêu?", true),
                Map.entry("Dị ứng của tôi là gì?", true),
                Map.entry("Mục tiêu sức khỏe của tôi?", true),
                Map.entry("Tôi ăn chay kiểu nào?", true),
                Map.entry("Tôi nên ăn gì để giảm cân?", false),
                Map.entry("Gợi ý bữa sáng và tối giàu protein, ít muối", false),
                Map.entry("Nếu tôi dị ứng đậu phộng thì thay bằng gì?", false),
                Map.entry("Vậy thực đơn đó có đủ sắt không?", false));

        cases.forEach((question, expectedFast) ->
                assertThat(router.route(question, profile, false).isPresent()).isEqualTo(expectedFast));
    }
}
