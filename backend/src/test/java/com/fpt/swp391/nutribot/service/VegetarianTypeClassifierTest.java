package com.fpt.swp391.nutribot.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

@DisplayName("Kiểm thử VegetarianTypeClassifier (NB-61)")
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
}
