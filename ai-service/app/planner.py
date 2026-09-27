"""Deterministic constraints and Gemini prompt for the NB-54 meal-planning flow."""

import json
import re
import unicodedata
from dataclasses import asdict, dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


MealGoal = Literal["lose_weight", "maintain_weight", "gain_muscle"]

# Gemini's daily calorie field is an estimate. This service has no structured
# per-meal nutrition dataset, so Python can only apply a sanity check here.
CALORIE_TOLERANCE_PERCENT = 0.20

ANIMAL_DERIVED_TERMS = (
    "thịt", "gà", "bò", "heo", "lợn", "cá", "hải sản", "tôm", "cua",
    "trứng", "sữa bò", "sữa dê", "phô mai", "mật ong", "gelatin", "whey",
    "casein", "mỡ động vật", "nước mắm",
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
    return bool(re.search(r"(?<![a-z0-9])" + re.escape(_term_key(term)) + r"(?![a-z0-9])", _term_key(text)))


def _is_allergy_conflict(ingredient: str, allergies: list[str]) -> bool:
    return any(_contains_term(ingredient, allergy) for allergy in allergies)


class MealPlanRequest(BaseModel):
    """Existing AI-service contract received from the integration layer."""

    model_config = ConfigDict(extra="forbid", alias_generator=_to_camel, populate_by_name=True)
    target_calories: int = Field(ge=1_000, le=4_500)
    health_goal: MealGoal
    available_ingredients: list[str] = Field(min_length=1, max_length=40)
    excluded_allergies: list[str] = Field(default_factory=list, max_length=30)
    bmi: float | None = Field(default=None, gt=0, le=100)

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


class MealPlanDay(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=_to_camel, populate_by_name=True)
    day: str = Field(min_length=1, max_length=30)
    breakfast: str = Field(min_length=3, max_length=500)
    lunch: str = Field(min_length=3, max_length=500)
    dinner: str = Field(min_length=3, max_length=500)


class MealPlanResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=_to_camel, populate_by_name=True)
    suggested_menu_title: str = Field(min_length=3, max_length=150)
    estimated_daily_calories: int = Field(ge=800, le=5_000)
    weekly_plan: list[MealPlanDay] = Field(min_length=7, max_length=7)

    @model_validator(mode="after")
    def require_unique_days(self) -> "MealPlanResponse":
        if len({_term_key(item.day) for item in self.weekly_plan}) != 7:
            raise ValueError("Thực đơn phải có bảy ngày khác nhau")
        return self


@dataclass(frozen=True, slots=True)
class MealPlanConstraints:
    """Normalized inputs used before Gemini and again in post-response checks."""

    target_calories: int
    health_goal: MealGoal
    safe_available_ingredients: list[str]
    excluded_allergies: list[str]
    bmi: float | None


def safe_available_ingredients(ingredients: list[str], allergies: list[str]) -> list[str]:
    """Remove any available ingredient that conflicts with a normalized allergy."""
    return [ingredient for ingredient in ingredients if not _is_allergy_conflict(ingredient, allergies)]


def prepare_meal_plan_constraints(request: MealPlanRequest) -> MealPlanConstraints:
    safe_ingredients = safe_available_ingredients(request.available_ingredients, request.excluded_allergies)
    if not safe_ingredients:
        raise ValueError("Tất cả nguyên liệu có sẵn đều xung đột với dị ứng")
    return MealPlanConstraints(
        target_calories=request.target_calories,
        health_goal=request.health_goal,
        safe_available_ingredients=safe_ingredients,
        excluded_allergies=request.excluded_allergies,
        bmi=request.bmi,
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
""".strip()


def build_meal_plan_prompt(constraints: MealPlanConstraints | MealPlanRequest) -> str:
    """Build Gemini input from normalized constraints, never unsafe raw ingredients."""
    if isinstance(constraints, MealPlanRequest):
        constraints = prepare_meal_plan_constraints(constraints)
    return (
        "Tạo bản xem trước thực đơn từ dữ liệu đã được hệ thống xác thực. Tên ngày dùng Thứ 2 đến Chủ Nhật. "
        "Không nhắc lại cảnh báo dị ứng trong tên món. JSON chỉ gồm suggestedMenuTitle, "
        "estimatedDailyCalories và weeklyPlan.\n"
        + json.dumps(asdict(constraints), ensure_ascii=False, indent=2)
    )


def validate_meal_plan_structure(plan: MealPlanResponse) -> MealPlanResponse:
    if len(plan.weekly_plan) != 7:
        raise ValueError("Kế hoạch phải có đúng bảy ngày")
    return plan


def _plan_text(plan: MealPlanResponse) -> str:
    return " ".join([plan.suggested_menu_title] + [meal for day in plan.weekly_plan for meal in (day.breakfast, day.lunch, day.dinner)])


def validate_allergies(plan: MealPlanResponse, excluded_allergies: list[str]) -> MealPlanResponse:
    if any(_contains_term(_plan_text(plan), allergy) for allergy in excluded_allergies):
        raise ValueError("Kế hoạch AI chứa nguyên liệu dị ứng không an toàn")
    return plan


def validate_vegan_safety(plan: MealPlanResponse) -> MealPlanResponse:
    if any(_contains_term(_plan_text(plan), term) for term in ANIMAL_DERIVED_TERMS):
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
) -> MealPlanResponse:
    """Post-Gemini deterministic validation; keeps the previous public call shape."""
    validate_meal_plan_structure(plan)
    validate_vegan_safety(plan)
    validate_allergies(plan, excluded_allergies)
    if target_calories is not None:
        validate_calorie_range(plan, target_calories)
    return plan
