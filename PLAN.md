# Plan: Fix Generate Weekly Meal Planner — Contract Mismatch

---

## Tổng quan

**Root cause:** AI service endpoint `/api/ai/generate-meal-plan` nhận `DeterministicPlannerRequest` (OR-Tools solver), nhưng backend gửi payload cũ (Gemini-style) → validation fail → **503 Service Unavailable**.

Backend cũ dùng AI để generate. Giờ cần align với deterministic planner contract.

---

## Các lỗi hiện tại

### Lỗi 1 — Contract mismatch (ROOT CAUSE)

| | Backend gửi | AI service nhận (expect) |
|---|---|---|
| Endpoint | `/api/ai/generate-meal-plan` | `/api/ai/generate-meal-plan` |
| Schema | `targetCalories`, `healthGoal`, `availableIngredients`, `availableDishes` (Gemini-style) | `DeterministicPlannerRequest`: `vegetarianType`, `nutritionTarget`, `canonicalDishes` |

**Files:**
- `backend/.../MealPlannerService.java:71-81` — payload sai contract
- `ai-service/app/main.py:123-128` — endpoint dùng `DeterministicPlannerRequest`

### Lỗi 2 — Thiếu nutrition targets
`DeterministicPlannerRequest` yêu cầu `nutrition_target: {calories, protein_g, carbs_g, fat_g, estimated}` — backend không gửi.

### Lỗi 3 — Allergy filter dùng names thay vì IDs
Backend gửi allergy names (string), deterministic service cần `allergy_ingredient_ids: list[int]`.

### Lỗi 4 — Dishes thiếu ingredient IDs + vegetarian_type
`canonical_dishes` trong `DeterministicPlannerRequest` yêu cầu mỗi dish có `ingredient_ids` tuple + `vegetarian_type` string.

---

## Contract chuẩn của AI service

### DeterministicPlannerRequest (ai-service/app/schemas/deterministic_planner.py)
```python
class DeterministicPlannerRequest(Base):
    vegetarian_type: str           # "VEGAN" | "LACTO" | "OVO" | "LACTO_OVO"
    allergy_ingredient_ids: list[int] | None
    nutrition_target: Target
    canonical_dishes: list[Dish]

class Target:
    calories: float (ge=0)
    protein_g: float (ge=0)
    carbs_g: float (ge=0)
    fat_g: float (ge=0)
    estimated: bool

class Dish:
    dish_id: int
    name: str
    description: str | None
    image_url: str | None
    category_id: int | None
    serving_size: float
    serving_unit: str
    calories: float
    protein_g: float
    carbs_g: float
    healthy_fats_g: float
    vegetarian_type: str
    is_active: bool
    ingredients: list[Ingredient]   # Ingredient = {ingredient_id, name}
```

---

## Các bước thực hiện

### Bước 1 — Thêm `NutritionTarget` vào `MealPlanGenerateRequest.java`

```java
// Thêm vào MealPlanGenerateRequest.java
@Data
public static class NutritionTargetRequest {
    private Double calories;
    private Double proteinG;
    private Double carbsG;
    private Double fatG;
    private Boolean estimated = false;
}

// Thêm field vào MealPlanGenerateRequest
private NutritionTargetRequest nutritionTarget;  // optional
```

### Bước 2 — Thêm Repository method lấy ingredient IDs

**`DishIngredientRepository.java`** — Thêm method:
```java
@Query("SELECT di.id.ingredientId FROM DishIngredient di WHERE di.id.dishId = :dishId")
List<Long> findIngredientIdsByDishId(@Param("dishId") Long dishId);

@Query("SELECT di.id.dishId, di.id.ingredientId FROM DishIngredient di WHERE di.id.dishId IN :dishIds")
List<Object[]> findIngredientIdsByDishIds(@Param("dishIds") List<Long> dishIds);
```

### Bước 3 — Chuyển allergy names → ingredient IDs

**`MealPlannerService.java`** — Thêm logic:
```java
// allergy names → ingredient IDs
Set<Long> allergyIngredientIds = new LinkedHashSet<>();
if (profile != null) {
    for (UserAllergy ua : profile.getAllergies()) {
        allergyIngredientIds.add(ua.getIngredient().getIngredientId());
    }
}
// Thêm từ request.getExcludedAllergies() nếu cần
```

### Bước 4 — Build đúng DeterministicPlannerRequest payload

**`MealPlannerService.java`** — Thay payload cũ:
```java
Map<String, Object> payload = new LinkedHashMap<>();
payload.put("vegetarianType", request.getVegetarianType() != null
    ? request.getVegetarianType() : "LACTO_OVO");
payload.put("allergyIngredientIds", allergyIngredientIds.isEmpty()
    ? null : new ArrayList<>(allergyIngredientIds));

// Nutrition target
NutritionTargetRequest nut = request.getNutritionTarget();
Double calories = nut != null ? nut.getCalories() : null;
Double proteinG = nut != null ? nut.getProteinG() : null;
Double carbsG = nut != null ? nut.getCarbsG() : null;
Double fatG = nut != null ? nut.getFatG() : null;
Boolean estimated = nut != null ? nut.getEstimated() : false;

// Fallback: tính từ NutritionTargetService nếu không có trong request
if (calories == null || proteinG == null || carbsG == null || fatG == null) {
    var nutService = nutritionTargetService.calculateTarget(username);
    calories = Optional.ofNullable(calories).orElse((double) nutService.calories());
    proteinG = Optional.ofNullable(proteinG).orElse(nutService.proteinG());
    carbsG = Optional.ofNullable(carbsG).orElse(nutService.carbsG());
    fatG = Optional.ofNullable(fatG).orElse(nutService.healthyFatsG());
    estimated = true;
}
payload.put("nutritionTarget", Map.of(
    "calories", calories,
    "proteinG", proteinG,
    "carbsG", carbsG,
    "fatG", fatG,
    "estimated", estimated
));

// Canonical dishes với ingredients
List<Map<String, Object>> canonicalDishes = new ArrayList<>();
for (Dish dish : availableDishes) {
    Map<String, Object> dishMap = new LinkedHashMap<>();
    dishMap.put("dishId", dish.getDishId());
    dishMap.put("name", dish.getName());
    dishMap.put("description", dish.getDescription());
    dishMap.put("imageUrl", dish.getImageUrl());
    dishMap.put("categoryId", dish.getCategory() != null ? dish.getCategory().getCategoryId() : null);
    dishMap.put("servingSize", dish.getServingSize());
    dishMap.put("servingUnit", dish.getServingUnit());
    dishMap.put("calories", dish.getCalories());
    dishMap.put("proteinG", dish.getProteinG());
    dishMap.put("carbsG", dish.getCarbsG());
    dishMap.put("healthyFatsG", dish.getHealthyFatsG());
    dishMap.put("vegetarianType", dish.getVegetarianType());
    dishMap.put("isActive", dish.isActive());
    // Ingredients
    List<Map<String, Object>> ingredients = new ArrayList<>();
    for (Ingredient ing : dish.getIngredients()) {
        ingredients.add(Map.of("ingredientId", ing.getIngredientId(), "name", ing.getName()));
    }
    dishMap.put("ingredients", ingredients);
    canonicalDishes.add(dishMap);
}
payload.put("canonicalDishes", canonicalDishes);
```

### Bước 5 — Fix response mapping

**`MealPlanGenerateResponse.java`** — Thêm field để parse deterministic response:
```java
// Thêm field mới để nhận deterministic response
private String status;
private List<Map<String, Object>> days;  // mỗi day có: day, meals, nutritionTotal, deviation
private Map<String, Object> weeklySummary;
```

### Bước 6 — Map deterministic response → MealPlanGenerateResponse

**`MealPlannerService.java`** — Sau khi gọi AI, map response:
```java
// deterministic response structure:
// {
//   "status": "OPTIMAL",
//   "days": [{day, meals: [{slot, dishId}], nutritionTotal, deviation}, ...],
//   "weeklySummary": {distinctDishCount, dishUsageCounts},
//   "reasonCodes": [],
//   "executionMetadata": {...}
// }

MealPlanGenerateResponse result = new MealPlanGenerateResponse();
result.setStatus(aiResponse.get("status"));
result.setSuggestedMenuTitle("Thực đơn tuần này");
result.setEstimatedDailyCalories(nutritionTarget.calories);

// Map days
List<MealPlanDayResponse> weeklyPlan = new ArrayList<>();
for (Map<String, Object> dayData : days) {
    String dayName = (String) dayData.get("day");
    List<Map<String, Object>> meals = (List<Map<String, Object>>) dayData.get("meals");

    MealPlanDishResponse breakfast = findDishResponse(meals, "BREAKFAST", dishesById);
    MealPlanDishResponse lunch = findDishResponse(meals, "LUNCH", dishesById);
    MealPlanDishResponse dinner = findDishResponse(meals, "DINNER", dishesById);

    weeklyPlan.add(new MealPlanDayResponse(dayName, breakfast, lunch, dinner));
}
result.setWeeklyPlan(weeklyPlan);
```

### Bước 7 — Inject dependencies

**`MealPlannerService.java`**:
```java
@RequiredArgsConstructor
public class MealPlannerService {
    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final DishRepository dishRepository;
    private final DishIngredientRepository dishIngredientRepository;  // THÊM
    private final NutritionTargetService nutritionTargetService;        // THÊM
    private final ObjectMapper objectMapper;
    // ...
}
```

---

## Files cần sửa

| File | Thay đổi |
|------|-----------|
| `MealPlanGenerateRequest.java` | Thêm `NutritionTargetRequest` inner class |
| `MealPlanDishResponse.java` | Đã có carbsG/healthyFatsG ✅ |
| `MealPlanGenerateResponse.java` | Thêm status, days, weeklySummary |
| `DishIngredientRepository.java` | Thêm method lấy ingredient IDs |
| `MealPlannerService.java` | Build đúng contract + allergy IDs + nutrition target + attach details |
| `MealPlannerController.java` | Đã có ✅ |

---

## Verification

1. **Compile backend:** `mvn compile -DskipTests`
2. **Test direct AI endpoint:**
   ```bash
   curl -X POST http://localhost:8000/api/ai/generate-meal-plan \
     -H "Content-Type: application/json" \
     -d '{
       "vegetarianType": "LACTO_OVO",
       "allergyIngredientIds": [1, 2],
       "nutritionTarget": {"calories": 2000, "proteinG": 80, "carbsG": 250, "fatG": 65, "estimated": false},
       "canonicalDishes": [...]
     }'
   ```
3. **Test backend endpoint** (cần auth token)
4. **Kiểm tra UI** hiển thị đúng 4 nutrition fields

---

## Dự đoán AI

**AI deterministic planner** (OR-Tools) nhận:
- `nutrition_target.calories` — target calories/ngày
- `nutrition_target.protein_g`, `carbs_g`, `fat_g` — macro targets/ngày

**Output:** Chọn dishes từ catalog sao cho mỗi ngày đạt đúng ± tolerance:
- Calories: ±10%
- Protein: ±20%
- Carbs: ±20%
- Fat: ±20%

**UI hiển thị:** Ước lượng calories/ngày (`estimated_daily_calories`) + dishes đã chọn với đầy đủ nutrition info.
