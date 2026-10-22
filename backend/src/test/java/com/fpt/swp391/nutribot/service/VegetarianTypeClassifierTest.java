package com.fpt.swp391.nutribot.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Kiểm thử VegetarianTypeClassifier (NB-61, NB-86)")
class VegetarianTypeClassifierTest {

    private final VegetarianTypeClassifier classifier = new VegetarianTypeClassifier();

    @Test
    @DisplayName("Nguyên liệu thuần chay -> VEGAN")
    void classify_plantOnly_returnsVegan() {
        String result = classifier.classify(List.of(
                "Gạo tấm", "Nấm đùi gà", "Đậu hũ trắng", "Cà rốt", "Dưa leo"));

        assertEquals(VegetarianTypeClassifier.VEGAN, result);
    }

    @Test
    @DisplayName("Có trứng -> OVO")
    void classify_eggOnly_returnsOvo() {
        assertEquals(VegetarianTypeClassifier.OVO,
                classifier.classify(List.of("Bột mì", "Trứng gà", "Đường")));
    }

    @Test
    @DisplayName("Có sữa -> LACTO")
    void classify_dairyOnly_returnsLacto() {
        assertEquals(VegetarianTypeClassifier.LACTO,
                classifier.classify(List.of("Bột mì", "Sữa bò", "Đường")));
    }

    @Test
    @DisplayName("Có cả trứng và sữa -> LACTO_OVO")
    void classify_eggAndDairy_returnsLactoOvo() {
        assertEquals(VegetarianTypeClassifier.LACTO_OVO,
                classifier.classify(List.of("Trứng gà", "Phô mai", "Bột mì")));
    }

    @Test
    @DisplayName("Nguyên liệu chứa thịt -> null (không gán loại chay)")
    void classify_animal_returnsNull() {
        assertNull(classifier.classify(List.of("Bún", "Thịt bò", "Hành")));
    }

    @Test
    @DisplayName("Danh sách rỗng hoặc null -> null")
    void classify_emptyOrNull_returnsNull() {
        assertNull(classifier.classify(List.of()));
        assertNull(classifier.classify(null));
        assertNull(classifier.classify(List.of("   ", "")));
    }

    @Test
    @DisplayName("Không bắt nhầm 'Nấm đùi gà' (chứa 'gà') thành động vật")
    void classify_mushroomAnimalMetaphor_staysVegan() {
        assertEquals(VegetarianTypeClassifier.VEGAN,
                classifier.classify(List.of("Nấm đùi gà", "Nấm hương", "Nấm kim châm")));
    }

    @Test
    @DisplayName("Không bắt nhầm sữa hạt 'Sữa đậu nành'/'Sữa yến mạch' thành sữa động vật")
    void classify_plantMilk_staysVegan() {
        assertEquals(VegetarianTypeClassifier.VEGAN,
                classifier.classify(List.of("Sữa đậu nành", "Sữa yến mạch", "Bơ đậu phộng", "Óc chó")));
    }

    @Test
    @DisplayName("Không bắt nhầm 'Óc chó' (chứa 'óc') thành hải sản")
    void classify_walnut_staysVegan() {
        assertEquals(VegetarianTypeClassifier.VEGAN, classifier.classify(List.of("Óc chó", "Hạt bí")));
    }

    @Test
    @DisplayName("Ghép cặp từ đúng ranh giới, không khớp substring ('các' không phải 'cá')")
    void classify_tokenBoundary_avoidsSubstringMatch() {
        assertEquals(VegetarianTypeClassifier.VEGAN,
                classifier.classify(List.of("Các loại rau", "Bột gạo")));
    }

    @Test
    @DisplayName("NB-86: Ba chỉ heo bị nhận diện là nguyên liệu động vật")
    void baChiHeo_nonVegetarian() {
        VegetarianTypeClassifier.Verdict verdict = classifier.evaluate(List.of("Ba chỉ heo", "Hành lá"));

        assertEquals(VegetarianTypeClassifier.Status.NON_VEGETARIAN, verdict.status());
        assertNull(verdict.type());
        assertTrue(verdict.animalIngredients().contains("Ba chỉ heo"));
    }

    @Test
    @DisplayName("NB-86: Ức gà bị nhận diện là nguyên liệu động vật")
    void ucGa_nonVegetarian() {
        assertEquals(VegetarianTypeClassifier.Status.NON_VEGETARIAN,
                classifier.evaluate(List.of("Ức gà", "Rau thơm")).status());
    }

    @Test
    @DisplayName("NB-86: Nước mắm và dầu hào bị nhận diện là nguyên liệu động vật")
    void condimentsWithAnimalOrigin_nonVegetarian() {
        assertEquals(VegetarianTypeClassifier.Status.NON_VEGETARIAN,
                classifier.evaluate(List.of("Nước mắm", "Đường")).status());
        assertEquals(VegetarianTypeClassifier.Status.NON_VEGETARIAN,
                classifier.evaluate(List.of("Dầu hào", "Tỏi")).status());
    }

    @Test
    @DisplayName("NB-86: Mắm cá cơm và chả cá bị nhận diện là nguyên liệu động vật")
    void fishProducts_nonVegetarian() {
        assertEquals(VegetarianTypeClassifier.Status.NON_VEGETARIAN,
                classifier.evaluate(List.of("Mắm cá cơm")).status());
        assertEquals(VegetarianTypeClassifier.Status.NON_VEGETARIAN,
                classifier.evaluate(List.of("Chả cá")).status());
    }

    @Test
    @DisplayName("NB-86: Món có chữ chay được miễn kiểm tra động vật")
    void meatNamedChay_vegan() {
        assertEquals(VegetarianTypeClassifier.VEGAN,
                classifier.evaluate(List.of("Thịt chay", "Nước mắm chay")).type());
    }

    @Test
    @DisplayName("NB-86: 'Sữa tươi' là LACTO")
    void suaTuoi_lacto() {
        assertEquals(VegetarianTypeClassifier.LACTO,
                classifier.evaluate(List.of("Sữa tươi", "Đường")).type());
    }

    @Test
    @DisplayName("NB-86: Trứng cá là động vật, không phải OVO")
    void trungCa_nonVegetarian() {
        assertEquals(VegetarianTypeClassifier.Status.NON_VEGETARIAN,
                classifier.evaluate(List.of("Trứng cá")).status());
    }

    @Test
    @DisplayName("NB-86: Danh sách nguyên liệu rỗng trả UNKNOWN")
    void emptyIngredients_unknown() {
        assertEquals(VegetarianTypeClassifier.Status.UNKNOWN, classifier.evaluate(List.of()).status());
        assertEquals(VegetarianTypeClassifier.Status.UNKNOWN, classifier.evaluate(null).status());
    }
}
