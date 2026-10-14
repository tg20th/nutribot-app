package com.fpt.swp391.nutribot.service;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * NB-61: Suy diễn loại ăn chay (VEGAN/LACTO/OVO/LACTO_OVO) cho món ăn được tạo
 * khi Admin duyệt đề xuất, dựa trên tên nguyên liệu một cách TẤT ĐỊNH (không gọi AI).
 *
 * <p>Vì catalog của hệ thống là thuần chay, mặc định trả về {@code VEGAN} và chỉ
 * "nâng cấp" lên LACTO/OVO/LACTO_OVO khi phát hiện bằng chứng rõ ràng về trứng/sữa.
 * Điều này ngăn màn hình khách báo "Compatibility not verified" do thiếu
 * {@code dishes.vegetarian_type}, nhưng vẫn an toàn hơn việc đoán bừa.
 *
 * <p>So khớp theo RANH GIỚI TỪ (không phải substring) để tránh bắt nhầm các tên
 * nguyên liệu thuần chay mang từ ngữ động vật, ví dụ:
 * <ul>
 *   <li>{@code "Nấm đùi gà"} chứa "gà" → được xử lý nhờ đánh dấu thực vật "nấm".</li>
 *   <li>{@code "Sữa đậu nành"}, {@code "Sữa yến mạch"} chứa "sữa" nhưng là sữa hạt.</li>
 *   <li>{@code "Bơ đậu phộng"} chứa "bơ" nhưng không phải bơ động vật.</li>
 * </ul>
 */
@Component
public class VegetarianTypeClassifier {

    public static final String VEGAN = "VEGAN";
    public static final String LACTO = "LACTO";
    public static final String OVO = "OVO";
    public static final String LACTO_OVO = "LACTO_OVO";

    /**
     * Dấu hiệu gốc thực vật: nếu tên nguyên liệu chứa một trong các từ này thì bỏ
     * qua hoàn toàn việc kiểm tra động vật/trứng/sữa (món đã là thuần chay).
     */
    private static final Set<String> PLANT_MARKERS = Set.of(
            "nấm",
            "đậu",
            "nước cốt dừa",
            "sữa hạt",
            "sữa yến mạch",
            "sữa gạo",
            "sữa dừa",
            "sữa thực vật",
            "sữa hạnh nhân",
            "dầu thực vật",
            "kem thực vật");

    /**
     * Chỉ dùng các cụm từ đủ mạnh để tránh nhầm với tên thuần chay; KHÔNG dùng
     * các từ đơn như "gà"/"bò"/"cá"/"ốc" (dễ trùng "Nấm đùi gà", "Óc chó"...).
     */
    private static final Set<String> ANIMAL_KEYWORDS = Set.of(
            "thịt",
            "hải sản",
            "tôm",
            "mực",
            "cua",
            "ghẹ",
            "nghêu",
            "sò",
            "cá hồi",
            "cá ngừ",
            "cá thu",
            "cá basa",
            "cá biển",
            "chả lụa",
            "xúc xích",
            "gelatin",
            "meat",
            "beef",
            "pork",
            "chicken",
            "fish",
            "shrimp",
            "seafood",
            "poultry");

    private static final Set<String> EGG_KEYWORDS = Set.of(
            "trứng",
            "egg",
            "lòng đỏ",
            "lòng trắng",
            "mayonnaise",
            "mayo");

    private static final Set<String> DAIRY_KEYWORDS = Set.of(
            "phô mai",
            "phomai",
            "cheese",
            "sữa bò",
            "sữa tươi",
            "sữa đặc",
            "sữa chua",
            "yogurt",
            "yoghurt",
            "whey",
            "casein",
            "kem sữa",
            "kem tươi",
            "whipping",
            "butter",
            "bơ động vật",
            "bơ lạt",
            "bơ nhạt",
            "bơ sữa",
            "sữa bột",
            "sữa nguyên kem");

    /**
     * @param ingredientNames danh sách tên nguyên liệu (đã tách khỏi công thức).
     * @return loại ăn chay suy diễn, hoặc {@code null} nếu không đủ dữ liệu để xác
     *         định hoặc nguyên liệu chứa thịt (không gán loại chay nào).
     */
    public String classify(List<String> ingredientNames) {
        if (ingredientNames == null) {
            return null;
        }

        boolean hasUsable = false;
        boolean hasEgg = false;
        boolean hasDairy = false;

        for (String raw : ingredientNames) {
            String name = normalize(raw);
            if (name.isEmpty()) {
                continue;
            }
            if (containsAny(name, PLANT_MARKERS)) {
                hasUsable = true;
                continue;
            }
            if (containsAny(name, ANIMAL_KEYWORDS)) {
                return null;
            }
            if (containsAny(name, EGG_KEYWORDS)) {
                hasEgg = true;
            }
            if (containsAny(name, DAIRY_KEYWORDS)) {
                hasDairy = true;
            }
            hasUsable = true;
        }

        if (!hasUsable) {
            return null;
        }
        if (hasEgg && hasDairy) {
            return LACTO_OVO;
        }
        if (hasEgg) {
            return OVO;
        }
        if (hasDairy) {
            return LACTO;
        }
        return VEGAN;
    }

    private static boolean containsAny(String normalizedName, Set<String> keywords) {
        String padded = " " + normalizedName + " ";
        for (String keyword : keywords) {
            if (padded.contains(" " + keyword + " ")) {
                return true;
            }
        }
        return false;
    }

    private static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String lowered = raw.toLowerCase(Locale.ROOT).trim();
        String spaced = lowered.replaceAll("[^\\p{L}\\p{N}]+", " ");
        return spaced.replaceAll("\\s+", " ").trim();
    }
}
