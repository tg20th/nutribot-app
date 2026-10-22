package com.fpt.swp391.nutribot.service;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * NB-61: Suy diễn loại ăn chay (VEGAN/LACTO/OVO/LACTO_OVO) cho món ăn được tạo
 * khi Admin duyệt đề xuất, dựa trên tên nguyên liệu một cách TẤT ĐỊNH (không gọi AI).
 *
 * <p>NB-86: Bổ sung kết luận 3 trạng thái ({@code VEGETARIAN},
 * {@code NON_VEGETARIAN}, {@code UNKNOWN}) để validator có thể CHẶN đề xuất chứa
 * nguyên liệu động vật thay vì âm thầm để {@code dishes.vegetarian_type = null}.
 *
 * <p>So khớp theo RANH GIỚI TỪ (không phải substring) để tránh bắt nhầm các tên
 * nguyên liệu thuần chay mang từ ngữ động vật, ví dụ:
 * <ul>
 *   <li>{@code "Nấm đùi gà"} chứa "gà" → được xử lý nhờ đánh dấu thực vật "nấm".</li>
 *   <li>{@code "Sữa đậu nành"}, {@code "Sữa yến mạch"} chứa "sữa" nhưng là sữa hạt.</li>
 *   <li>{@code "Bơ đậu phộng"} chứa "bơ" nhưng không phải bơ động vật.</li>
 *   <li>{@code "Óc chó"} chứa "óc" nhưng là hạt.</li>
 * </ul>
 */
@Component
public class VegetarianTypeClassifier {

    public static final String VEGAN = "VEGAN";
    public static final String LACTO = "LACTO";
    public static final String OVO = "OVO";
    public static final String LACTO_OVO = "LACTO_OVO";

    public enum Status {
        VEGETARIAN,
        NON_VEGETARIAN,
        UNKNOWN
    }

    /**
     * Kết quả phân loại: {@code type} chỉ có giá trị khi {@code status} là
     * VEGETARIAN; {@code animalIngredients} liệt kê nguyên liệu bị coi là động
     * vật để Admin đối chiếu.
     */
    public record Verdict(Status status, String type, List<String> animalIngredients, String reason) {

        public boolean isVegetarian() {
            return status == Status.VEGETARIAN;
        }
    }

    /**
     * Dấu hiệu gốc thực vật: nếu tên nguyên liệu chứa một trong các từ này thì bỏ
     * qua hoàn toàn việc kiểm tra động vật/trứng/sữa (món đã là thuần chay).
     * Đây cũng là lưới an toàn cho các từ đơn dễ gây nhầm lẫn.
     */
    private static final Set<String> PLANT_MARKERS = Set.of(
            "nấm",
            "đậu",
            "chay",
            "ốc chó",
            "cà chua",
            "nước cốt dừa",
            "nước cốt chanh",
            "sữa hạt",
            "sữa yến mạch",
            "sữa gạo",
            "sữa dừa",
            "sữa thực vật",
            "sữa hạnh nhân",
            "sữa đậu nành",
            "coconut milk",
            "soy milk",
            "almond milk",
            "oat milk",
            "dầu thực vật",
            "kem thực vật",
            "bơ đậu phộng",
            "đậu hũ",
            "đậu phụ",
            "tofu",
            "tempeh",
            "seitan");

    /**
     * Tổ hợp chứa từ khóa trứng nhưng thực chất là động vật (trứng cá/cua/tôm/mực).
     * Phải kiểm tra TRƯỚC nhóm trứng để không phân loại nhầm thành OVO.
     */
    private static final Set<String> NON_VEGETARIAN_EGG_PHRASES = Set.of(
            "trứng cá",
            "trứng cua",
            "trứng tôm",
            "trứng mực");

    /**
     * Sản phẩm từ sữa nhưng tên chứa tên con vật ("sữa bò", "sữa dê"...). Phải
     * kiểm tra TRƯỚC nhóm động vật để không chặn nhầm thành NON_VEGETARIAN.
     */
    private static final Set<String> DAIRY_ANIMAL_PHRASES = Set.of(
            "sữa bò",
            "sữa dê",
            "sữa cừu",
            "sữa trâu");

    /**
     * NB-86: Bổ sung tên gọi thịt/cá/hải sản phổ biến trong ẩm thực Việt. Chỉ dùng
     * các cụm đủ mạnh hoặc từ đơn đã được bảo vệ bằng {@link #PLANT_MARKERS}.
     */
    private static final Set<String> ANIMAL_KEYWORDS = Set.of(
            "thịt",
            "heo",
            "lợn",
            "bò",
            "gà",
            "vịt",
            "ngan",
            "dê",
            "cừu",
            "thỏ",
            "cá",
            "tôm",
            "mực",
            "cua",
            "ghẹ",
            "nghêu",
            "sò",
            "hàu",
            "ốc",
            "bạch tuộc",
            "hải sản",
            "ba chỉ",
            "sườn",
            "nạm",
            "giò lụa",
            "giò heo",
            "giò thủ",
            "giò bò",
            "giò gà",
            "chả lụa",
            "chả quế",
            "chả cá",
            "chả mực",
            "chả tôm",
            "xúc xích",
            "pate",
            "patê",
            "mắm",
            "nước mắm",
            "mắm tôm",
            "mắm cá",
            "mắm ruốc",
            "dầu hào",
            "xương",
            "gan heo",
            "gan bò",
            "gan gà",
            "gan vịt",
            "óc heo",
            "óc bò",
            "lòng non",
            "lòng già",
            "lòng heo",
            "lòng bò",
            "lòng gà",
            "tiết canh",
            "huyết",
            "da heo",
            "da gà",
            "gelatin",
            "meat",
            "beef",
            "pork",
            "chicken",
            "duck",
            "lamb",
            "fish",
            "shrimp",
            "prawn",
            "seafood",
            "poultry",
            "bacon",
            "ham",
            "sausage",
            "anchovy",
            "oyster",
            "squid",
            "crab",
            "mussel",
            "clam",
            "tuna",
            "salmon",
            "lobster");

    private static final Set<String> EGG_KEYWORDS = Set.of(
            "trứng",
            "egg",
            "lòng đỏ",
            "lòng trắng",
            "mayonnaise",
            "mayo",
            "albumin");

    private static final Set<String> DAIRY_KEYWORDS = Set.of(
            "phô mai",
            "phomai",
            "cheese",
            "mozzarella",
            "parmesan",
            "feta",
            "cream cheese",
            "sour cream",
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
            "sữa nguyên kem",
            "milk");

    private static final int MAX_REPORTED_ANIMAL_INGREDIENTS = 5;

    /**
     * @param ingredientNames danh sách tên nguyên liệu (đã tách khỏi công thức).
     * @return loại ăn chay suy diễn, hoặc {@code null} nếu không đủ dữ liệu để xác
     *         định hoặc nguyên liệu chứa thịt (không gán loại chay nào).
     */
    public String classify(List<String> ingredientNames) {
        Verdict verdict = evaluate(ingredientNames);
        return verdict.status() == Status.VEGETARIAN ? verdict.type() : null;
    }

    public Verdict evaluate(List<String> ingredientNames) {
        if (ingredientNames == null || ingredientNames.isEmpty()) {
            return new Verdict(Status.UNKNOWN, null, List.of(), "Không có nguyên liệu để phân loại");
        }

        boolean hasUsable = false;
        boolean hasEgg = false;
        boolean hasDairy = false;
        List<String> animalIngredients = new ArrayList<>();

        for (String raw : ingredientNames) {
            String name = normalize(raw);
            if (name.isEmpty()) {
                continue;
            }
            if (containsAny(name, PLANT_MARKERS)) {
                hasUsable = true;
                continue;
            }
            if (containsAny(name, NON_VEGETARIAN_EGG_PHRASES)) {
                addAnimalIngredient(animalIngredients, raw);
                continue;
            }
            if (containsAny(name, DAIRY_ANIMAL_PHRASES)) {
                hasDairy = true;
                hasUsable = true;
                continue;
            }
            if (containsAny(name, EGG_KEYWORDS)) {
                hasEgg = true;
                hasUsable = true;
                continue;
            }
            if (containsAny(name, ANIMAL_KEYWORDS)) {
                addAnimalIngredient(animalIngredients, raw);
                continue;
            }
            if (containsAny(name, DAIRY_KEYWORDS)) {
                hasDairy = true;
            }
            hasUsable = true;
        }

        if (!animalIngredients.isEmpty()) {
            return new Verdict(Status.NON_VEGETARIAN, null, List.copyOf(animalIngredients),
                    "Nguyên liệu động vật: " + String.join(", ", animalIngredients));
        }
        if (!hasUsable) {
            return new Verdict(Status.UNKNOWN, null, List.of(), "Không có nguyên liệu để phân loại");
        }
        String type = resolveType(hasEgg, hasDairy);
        return new Verdict(Status.VEGETARIAN, type, List.of(), null);
    }

    private static String resolveType(boolean hasEgg, boolean hasDairy) {
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

    private static void addAnimalIngredient(List<String> target, String raw) {
        if (target.size() >= MAX_REPORTED_ANIMAL_INGREDIENTS) {
            return;
        }
        String label = raw == null ? "" : raw.trim();
        if (!label.isEmpty() && !target.contains(label)) {
            target.add(label);
        }
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
