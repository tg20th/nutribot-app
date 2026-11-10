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
        boolean vietnamese = isVietnamese(message);
        if (isGreeting(text)) return Optional.of(vietnamese ? "Xin chào. Tôi có thể hỗ trợ bạn về dinh dưỡng, món chay và các bữa ăn cân bằng." : "Hello. I can help with nutrition, vegetarian food, and balanced meals.");
        if (isThanks(text)) return Optional.of(vietnamese ? "Rất vui được hỗ trợ bạn." : "You're welcome.");
        if (guest || profile == null || !isOwnProfileQuestion(text) || isAdviceOrConditionalQuestion(text)) return Optional.empty();
        if (contains(text, "bmi")) return Optional.of(profile.bmi() == null ? "Your profile does not have enough height and weight data to calculate BMI." : "Your current BMI is " + profile.bmi() + (profile.bmiCategory() == null ? "." : " (" + profile.bmiCategory() + ")."));
        if (contains(text, "di ung", "allerg")) return Optional.of(profile.allergies() == null || profile.allergies().isEmpty() ? "Your profile does not list any allergies." : "Allergies saved in your profile: " + String.join(", ", profile.allergies()) + ".");
        if (contains(text, "muc tieu", "health goal")) return Optional.of(profile.healthGoal() == null || profile.healthGoal().isBlank() ? "Your profile does not have a health goal yet." : "Your saved health goal is: " + profile.healthGoal() + ".");
        if (contains(text, "an chay", "vegetarian", "vegan", "lacto", "ovo")) return Optional.of(profile.vegetarianType() == null || profile.vegetarianType().isBlank() ? "Your profile does not have a vegetarian diet selected yet." : "Your saved vegetarian diet is: " + profile.vegetarianType() + ".");
        return Optional.empty();
    }
    private boolean isOwnProfileQuestion(String text) { return contains(text, "cua toi", "cua minh", "toi", "minh", "my ", " me "); }
    private boolean isAdviceOrConditionalQuestion(String text) { return contains(text, "nen ", "goi y", "thuc don", "thay bang", "neu ", " vi sao", "lam sao", "the nao", "co du "); }
    private boolean isGreeting(String text) { return text.matches("^(xin chao|chao|hello|hi|hey)( ban| nutribot)?[!. ]*$"); }
    private boolean isThanks(String text) { return text.matches("^(cam on|thanks|thank you|tks|thx)( ban| nutribot)?[!. ]*$"); }
    private boolean contains(String text, String... words) { for (String word : words) if (text.contains(word)) return true; return false; }
    private boolean isVietnamese(String text) { return text != null && (text.matches(".*[ăâđêôơưĂÂĐÊÔƠƯ].*") || contains(normalize(text), " an ", " nen ", " gi ", " bua ", " mon ", " khong ", " toi ", " minh ")); }
    private String normalize(String text) { return Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " "); }
}
