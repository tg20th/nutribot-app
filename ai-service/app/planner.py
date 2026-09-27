"""Deterministic constraints and Gemini prompt for the NB-54 meal-planning flow."""

import json
import re
import unicodedata
from dataclasses import asdict, dataclass
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


MealGoal = Literal["lose_weight", "maintain_weight", "gain_muscle"]
WEEKDAY_ORDER = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")

# Gemini's daily calorie field is an estimate. This service has no structured
# per-meal nutrition dataset, so Python can only apply a sanity check here.
CALORIE_TOLERANCE_PERCENT = 0.20

ANIMAL_DERIVED_TERMS = (
    "thịt", "gà", "bò", "heo", "lợn", "cá", "hải sản", "tôm", "cua",
    "trứng", "sữa bò", "sữa dê", "phô mai", "mật ong", "gelatin", "whey",
    "casein", "mỡ động vật", "nước mắm",
    "meat", "chicken", "beef", "pork", "fish", "seafood", "shrimp", "crab",
    "egg", "milk", "cheese", "honey", "gelatin", "butter", "cream", "yogurt",
)


def _to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.title() for part in tail)


def _term_key(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.casefold().replace("đ", "d"))
    return "".join(character for character in decomposed if unicodedata.category(character) != "Mn")


def _normalise_names(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        clean = " ".join(value.split())
        key = _term_key(clean)
        if clean and key not in seen:
            result.append(clean)
            seen.add(key)
    return result


def _contains_term(text: str, term: str) -> bool:
    normalized_term = _term_key(term)
    # Ingredient and allergy labels often differ only by a regular English
    # plural (for example, "Peanut" vs "Peanuts"). Treat those as the same
    # safety term while retaining whole-word matching to avoid substrings.
    plural_suffix = r"s?" if normalized_term and normalized_term[-1].isalnum() else ""
    pattern = r"(?<![a-z0-9])" + re.escape(normalized_term) + plural_suffix + r"(?![a-z0-9])"
    return bool(re.search(pattern, _term_key(text)))


def _is_allergy_conflict(ingredient: str, allergies: list[str]) -> bool:
    return any(_contains_term(ingredient, allergy) for allergy in allergies)


def _is_animal_derived(value: str) -> bool:
    return any(_contains_term(value, term) for term in ANIMAL_DERIVED_TERMS)


class MealPlanRequest(BaseModel):
    """Existing AI-service contract received from the integration layer."""

    model_config = ConfigDict(extra="forbid", alias_generator=_to_camel, populate_by_name=True)
    target_calories: int = Field(ge=1_000, le=4_500)
    health_goal: MealGoal
    available_ingredients: list[str] = Field(min_length=1, max_length=40)
    excluded_allergies: list[str] = Field(default_factory=list, max_length=30)
    bmi: float | None = Field(default=None, gt=0, le=100)
    available_dishes: list["MealPlanDishOption"] = Field(min_length=1)

    @field_validator("health_goal", mode="before")
    @classmethod
    def normalise_goal(cls, value: object) -> object:
        return "maintain_weight" if value == "maintain" else value

    @field_validator("available_ingredients", "excluded_allergies")
    @classmethod
    def normalise_lists(cls, values: list[str]) -> list[str]:
        return _normalise_names(values)

    @model_validator(mode="after")
    def require_safe_ingredient_after_normalisation(self) -> "MealPlanRequest":
        if not self.available_ingredients:
            raise ValueError("Cần ít nhất một nguyên liệu có sẵn")
        if not safe_available_ingredients(self.available_ingredients, self.excluded_allergies):
            raise ValueError("Tất cả nguyên liệu có sẵn đều xung đột với dị ứng")
        return self

    @model_validator(mode="after")
    def require_unique_available_dish_ids(self) -> "MealPlanRequest":
        dish_ids = [dish.dish_id for dish in self.available_dishes]
        if len(set(dish_ids)) != len(dish_ids):
            raise ValueError("Available dishes must have unique IDs")
        return self


class MealPlanDishOption(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=_to_camel, populate_by_name=True)
    dish_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=150)
    calories: int = Field(ge=0)
    protein_g: float | None = Field(default=None, ge=0)


class MealPlanSelection(BaseModel):
    model_config = ConfigDict(extra="ignore", alias_generator=_to_camel, populate_by_name=True)
    dish_id: int = Field(ge=1)
    servings: float = Field(ge=0.01, le=99)

    @field_validator("servings")
    @classmethod
    def limit_serving_precision(cls, value: float) -> float:
        if Decimal(str(value)).as_tuple().exponent < -2:
            raise ValueError("Servings support at most two decimal places")
        return value


MealPlanRequest.model_rebuild()


class MealPlanDay(BaseModel):
    model_config = ConfigDict(extra="ignore", alias_generator=_to_camel, populate_by_name=True)
    day: str = Field(min_length=1, max_length=30)
    breakfast: MealPlanSelection
    lunch: MealPlanSelection
    dinner: MealPlanSelection


class MealPlanResponse(BaseModel):
    model_config = ConfigDict(extra="ignore", alias_generator=_to_camel, populate_by_name=True)
    suggested_menu_title: str = Field(min_length=3, max_length=150)
    estimated_daily_calories: int = Field(ge=800, le=5_000)
    weekly_plan: list[MealPlanDay] = Field(min_length=7, max_length=7)

    @model_validator(mode="after")
    def require_unique_days(self) -> "MealPlanResponse":
        day_labels = [_term_key(item.day) for item in self.weekly_plan]
        if len(set(day_labels)) != 7:
            raise ValueError("Thực đơn phải có bảy ngày khác nhau")
        if tuple(day_labels) != WEEKDAY_ORDER:
            raise ValueError("Days must be ordered Monday through Sunday")
        return self


@dataclass(frozen=True, slots=True)
class MealPlanConstraints:
    """Normalized inputs used before Gemini and again in post-response checks."""

    target_calories: int
    health_goal: MealGoal
    safe_available_ingredients: list[str]
    excluded_allergies: list[str]
    bmi: float | None
    available_dishes: list[MealPlanDishOption]


def safe_available_ingredients(ingredients: list[str], allergies: list[str]) -> list[str]:
    """Remove any available ingredient that conflicts with a normalized allergy."""
    return [ingredient for ingredient in ingredients if not _is_allergy_conflict(ingredient, allergies)]


def prepare_meal_plan_constraints(request: MealPlanRequest) -> MealPlanConstraints:
    safe_ingredients = safe_available_ingredients(request.available_ingredients, request.excluded_allergies)
    if not safe_ingredients:
        raise ValueError("Tất cả nguyên liệu có sẵn đều xung đột với dị ứng")
    vegan_dishes = [dish for dish in request.available_dishes if not _is_animal_derived(dish.name)]
    if not vegan_dishes:
        raise ValueError("Không có món thuần chay trong danh mục để tạo thực đơn")
    return MealPlanConstraints(
        target_calories=request.target_calories,
        health_goal=request.health_goal,
        safe_available_ingredients=safe_ingredients,
        excluded_allergies=request.excluded_allergies,
        bmi=request.bmi,
        available_dishes=vegan_dishes,
    )


PLANNER_SYSTEM_INSTRUCTION = """
Bạn là NutriBot Meal Planner. Chỉ tạo thực đơn 100% thuần chay phù hợp văn hóa Việt Nam.
Trả về JSON duy nhất, đúng schema được cung cấp: đúng bảy ngày riêng biệt và mỗi ngày có breakfast, lunch, dinner.
Không dùng thịt, gia cầm, cá, hải sản, trứng, sữa động vật, mật ong, gelatin hoặc dẫn xuất động vật rõ ràng.
Danh sách dị ứng là ràng buộc cứng, không xuất hiện trong bất kỳ món, nước dùng, sốt hoặc thành phần nào.
targetCalories và healthGoal do hệ thống cung cấp là ràng buộc cứng: không tự thay đổi chúng. Ưu tiên mạnh
safeAvailableIngredients, nhưng có thể bổ sung nguyên liệu vegan phổ biến để bữa ăn hợp lý và đa dạng.
BMI chỉ là ngữ cảnh hỗ trợ, không tính lại BMI và không đưa ra chẩn đoán hay lời khuyên y khoa.
estimatedDailyCalories là ước lượng hợp lý quanh targetCalories, không khẳng định là số liệu y khoa chính xác.
Chỉ chọn dishId trong availableDishes; mỗi món trả đúng dishId và servings, không tự đặt tên hoặc dinh dưỡng.
""".strip()


def build_meal_plan_prompt(constraints: MealPlanConstraints | MealPlanRequest) -> str:
    """Build Gemini input from normalized constraints, never unsafe raw ingredients."""
    if isinstance(constraints, MealPlanRequest):
        constraints = prepare_meal_plan_constraints(constraints)
    prompt_data = asdict(constraints)
    prompt_data["available_dishes"] = [dish.model_dump(by_alias=True) for dish in constraints.available_dishes]
    return (
        "Generate the seven days in this exact order with these exact English labels: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday. "
        "Tạo bản xem trước thực đơn từ dữ liệu đã được hệ thống xác thực. Nhãn ngày phải dùng chính xác tên tiếng Anh được liệt kê phía trên. "
        "Không nhắc lại cảnh báo dị ứng trong tên món. JSON chỉ gồm suggestedMenuTitle, "
        "estimatedDailyCalories và weeklyPlan. Mỗi bữa chỉ trả về dishId có trong availableDishes và servings; "
        "không tự tạo tên món hoặc mã món.\n"
        + json.dumps(prompt_data, ensure_ascii=False, indent=2)
    )


def validate_meal_plan_structure(plan: MealPlanResponse) -> MealPlanResponse:
    if len(plan.weekly_plan) != 7:
        raise ValueError("Kế hoạch phải có đúng bảy ngày")
    return plan


def _selected_dishes(plan: MealPlanResponse, available_dishes: list[MealPlanDishOption]) -> list[MealPlanDishOption]:
    dishes_by_id = {dish.dish_id: dish for dish in available_dishes}
    selected: list[MealPlanDishOption] = []
    for day in plan.weekly_plan:
        for meal in (day.breakfast, day.lunch, day.dinner):
            dish = dishes_by_id.get(meal.dish_id)
            if dish is None:
                raise ValueError("Meal plan contains a dish outside the allowed catalog")
            selected.append(dish)
    return selected


def validate_allergies(plan: MealPlanResponse, excluded_allergies: list[str], available_dishes: list[MealPlanDishOption]) -> MealPlanResponse:
    text = " ".join([plan.suggested_menu_title] + [dish.name for dish in _selected_dishes(plan, available_dishes)])
    if any(_contains_term(text, allergy) for allergy in excluded_allergies):
        raise ValueError("Kế hoạch AI chứa nguyên liệu dị ứng không an toàn")
    return plan


def validate_vegan_safety(plan: MealPlanResponse, available_dishes: list[MealPlanDishOption]) -> MealPlanResponse:
    text = " ".join([plan.suggested_menu_title] + [dish.name for dish in _selected_dishes(plan, available_dishes)])
    if _is_animal_derived(text):
        raise ValueError("Kế hoạch AI chứa thành phần không thuần chay")
    return plan


def validate_calorie_range(plan: MealPlanResponse, target_calories: int) -> MealPlanResponse:
    if abs(plan.estimated_daily_calories - target_calories) > target_calories * CALORIE_TOLERANCE_PERCENT:
        raise ValueError("Ước lượng calo của kế hoạch lệch quá xa mục tiêu")
    return plan


def validate_meal_plan_safety(
    plan: MealPlanResponse,
    excluded_allergies: list[str],
    target_calories: int | None = None,
    available_dishes: list[MealPlanDishOption] | None = None,
) -> MealPlanResponse:
    """Validate generated structure, catalog IDs, diet and calorie range."""
    if not available_dishes:
        raise ValueError("An allowed dish catalog is required to validate a plan")
    validate_meal_plan_structure(plan)
    validate_vegan_safety(plan, available_dishes)
    validate_allergies(plan, excluded_allergies, available_dishes)
    if target_calories is not None:
        validate_calorie_range(plan, target_calories)
    return plan
