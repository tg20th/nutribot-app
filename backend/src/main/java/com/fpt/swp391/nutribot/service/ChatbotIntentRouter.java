package com.fpt.swp391.nutribot.service;

import com.fpt.swp391.nutribot.dto.response.HealthProfileResponse;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Optional;

/** Deterministic fast path. Ambiguous or advisory requests deliberately return empty. */
@Service
public class ChatbotIntentRouter {
    public Optional<String> route(String message, HealthProfileResponse profile, boolean guest) {
        String text = normalize(message);
        if (isGreeting(text)) return Optional.of("Chào bạn! NutriBot có thể hỗ trợ về dinh dưỡng và ăn chay.");
        if (isThanks(text)) return Optional.of("Rất vui được hỗ trợ bạn!");
        if (guest || profile == null || !isOwnProfileQuestion(text) || isAdviceOrConditionalQuestion(text)) return Optional.empty();

        if (contains(text, "bmi")) {
            return Optional.of(profile.bmi() == null
                    ? "Bạn chưa có đủ chiều cao và cân nặng để tính BMI."
                    : "BMI hiện tại của bạn là " + profile.bmi() +
                    (profile.bmiCategory() == null ? "." : " (" + profile.bmiCategory() + ")."));
        }
        if (contains(text, "di ung", "allerg")) {
            return Optional.of(profile.allergies() == null || profile.allergies().isEmpty()
                    ? "Hồ sơ của bạn hiện chưa ghi nhận dị ứng nào."
                    : "Dị ứng đã lưu trong hồ sơ của bạn: " + String.join(", ", profile.allergies()) + ".");
        }
        if (contains(text, "muc tieu", "health goal")) {
            return Optional.of(profile.healthGoal() == null || profile.healthGoal().isBlank()
                    ? "Bạn chưa đặt mục tiêu sức khỏe trong hồ sơ."
                    : "Mục tiêu sức khỏe đã lưu của bạn là: " + profile.healthGoal() + ".");
        }
        if (contains(text, "an chay", "vegetarian", "vegan", "lacto", "ovo")) {
            return Optional.of(profile.vegetarianType() == null || profile.vegetarianType().isBlank()
                    ? "Bạn chưa chọn chế độ ăn chay trong hồ sơ."
                    : "Chế độ ăn chay đã lưu của bạn là: " + profile.vegetarianType() + ".");
        }
        return Optional.empty();
    }

    private boolean isOwnProfileQuestion(String text) {
        return contains(text, "cua toi", "cua minh", "toi", "minh", "my ", " me ");
    }
    private boolean isAdviceOrConditionalQuestion(String text) {
        return contains(text, "nen ", "goi y", "thuc don", "thay bang", "neu ", " vi sao", "lam sao", "the nao", "co du ");
    }
    private boolean isGreeting(String text) { return text.matches("^(xin chao|chao|hello|hi|hey)( ban| nutribot)?[!. ]*$"); }
    private boolean isThanks(String text) { return text.matches("^(cam on|thanks|thank you|tks|thx)( ban| nutribot)?[!. ]*$"); }
    private boolean contains(String text, String... words) { for (String word : words) if (text.contains(word)) return true; return false; }
    private String normalize(String text) { return Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " "); }
}
