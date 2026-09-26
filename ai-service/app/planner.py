"""Ràng buộc dữ liệu và prompt cho pipeline thực đơn tuần NB-54."""

import json
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


MealGoal = Literal["lose_weight", "maintain_weight", "gain_muscle"]


def _to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.title() for part in tail)


def _normalise_names(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        clean = value.strip()
        key = clean.casefold()
        if clean and key not in seen:
            result.append(clean)
            seen.add(key)
    return result


class MealPlanRequest(BaseModel):
    """Payload nội bộ từ Spring Boot; không nhận danh tính người dùng."""

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
    def require_ingredient_after_normalisation(self) -> "MealPlanRequest":
        if not self.available_ingredients:
            raise ValueError("Cần ít nhất một nguyên liệu có sẵn")
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
        days = [item.day.casefold().strip() for item in self.weekly_plan]
        if len(set(days)) != 7:
            raise ValueError("Thực đơn phải có bảy ngày khác nhau")
        return self


PLANNER_SYSTEM_INSTRUCTION = """
Bạn là NutriBot Meal Planner. Chỉ lập thực đơn thuần chay (vegan) phù hợp văn hóa Việt Nam.
Không dùng thịt, gia cầm, cá, hải sản, trứng, sữa động vật, mật ong, gelatin hoặc dẫn xuất động vật.
Dị ứng hoặc nhóm cần tránh là ràng buộc cứng: không đưa chúng vào bất kỳ bữa nào, kể cả dạng sốt.
Lập đúng bảy ngày, mỗi ngày đúng ba bữa sáng, trưa, tối. Ưu tiên tận dụng nguyên liệu có sẵn nhưng
được phép thêm nguyên liệu thuần chay phổ biến để cân bằng bữa ăn. Điều chỉnh khẩu phần hợp lý theo
mục tiêu và mức calo, không đưa khuyến cáo y khoa. Trả về JSON duy nhất, khớp schema đã cho.
""".strip()


def build_meal_plan_prompt(request: MealPlanRequest) -> str:
    payload = request.model_dump(exclude_none=True)
    return (
        "Tạo bản xem trước thực đơn tuần từ dữ liệu sau. Tên ngày dùng Thứ 2 đến Chủ Nhật; "
        "không nhắc lại cảnh báo dị ứng trong tên món.\n"
        + json.dumps(payload, ensure_ascii=False, indent=2)
    )


def validate_meal_plan_safety(plan: MealPlanResponse, excluded_allergies: list[str]) -> MealPlanResponse:
    """Chặn câu trả lời có từ dị ứng hoặc thành phần không thuần chay rõ ràng."""
    text = " ".join([plan.suggested_menu_title] + [meal for day in plan.weekly_plan for meal in (day.breakfast, day.lunch, day.dinner)]).casefold()
    unsafe_terms = [term.casefold() for term in excluded_allergies if term.strip()]
    unsafe_terms += ["thịt", "gà", "bò", "heo", "lợn", "cá", "hải sản", "tôm", "cua", "trứng", "sữa bò", "mật ong", "gelatin"]
    if any(re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", text) for term in unsafe_terms):
        raise ValueError("Kế hoạch AI chứa nguyên liệu không an toàn")
    return plan
