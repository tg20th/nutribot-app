import json

import pytest
from pydantic import ValidationError

from app.planner import (
    MealPlanRequest,
    MealPlanResponse,
    build_meal_plan_prompt,
    prepare_meal_plan_constraints,
    validate_meal_plan_safety,
)


def valid_plan(calories: int = 1800) -> MealPlanResponse:
    return MealPlanResponse(
        suggested_menu_title="Thực đơn chay cân bằng 7 ngày",
        estimated_daily_calories=calories,
        weekly_plan=[
            {"day": f"Thứ {index}", "breakfast": "Yến mạch hạt chia", "lunch": "Đậu hũ sốt nấm", "dinner": "Canh rau củ"}
            for index in range(2, 9)
        ],
    )


def test_valid_request_builds_a_safe_seven_day_plan():
    request = MealPlanRequest(
        target_calories=1800,
        health_goal="maintain",
        bmi=20.2,
        available_ingredients=["Đậu hũ", "Nấm", "Rau cải"],
        excluded_allergies=["Đậu phộng"],
    )

    constraints = prepare_meal_plan_constraints(request)

    assert request.health_goal == "maintain_weight"
    assert constraints.safe_available_ingredients == ["Đậu hũ", "Nấm", "Rau cải"]
    assert validate_meal_plan_safety(valid_plan(), constraints.excluded_allergies, constraints.target_calories)


def test_allergy_normalisation_removes_unsafe_available_ingredient_from_prompt():
    request = MealPlanRequest(
        target_calories=1800,
        health_goal="maintain_weight",
        available_ingredients=["Đậu Hũ", "Nấm", "Đậu Phộng"],
        excluded_allergies=["đậu phộng"],
    )

    prompt = build_meal_plan_prompt(request)
    payload = json.loads(prompt[prompt.index("{"):])

    assert payload["safe_available_ingredients"] == ["Đậu Hũ", "Nấm"]
    assert payload["excluded_allergies"] == ["đậu phộng"]


@pytest.mark.parametrize("unsafe_meal", ["Trứng hấp", "Canh cá", "Sữa bò", "Chè mật ong"])
def test_safety_validation_rejects_non_vegan_meals(unsafe_meal: str):
    plan = valid_plan()
    plan.weekly_plan[0].lunch = unsafe_meal

    with pytest.raises(ValueError, match="không thuần chay"):
        validate_meal_plan_safety(plan, [], 1800)


@pytest.mark.parametrize("count", [6, 8])
def test_meal_plan_requires_exactly_seven_days(count: int):
    data = valid_plan().model_dump()
    data["weekly_plan"] = data["weekly_plan"][:count] if count < 7 else data["weekly_plan"] + [data["weekly_plan"][0].copy()]

    with pytest.raises(ValidationError):
        MealPlanResponse.model_validate(data)


def test_meal_plan_rejects_duplicate_days():
    data = valid_plan().model_dump()
    data["weekly_plan"][-1]["day"] = "Thứ 2"

    with pytest.raises(ValidationError, match="bảy ngày khác nhau"):
        MealPlanResponse.model_validate(data)


def test_request_rejects_invalid_calories_and_allergy_only_ingredients():
    with pytest.raises(ValidationError):
        MealPlanRequest(target_calories=900, health_goal="maintain", available_ingredients=["Nấm"])
    with pytest.raises(ValidationError, match="xung đột với dị ứng"):
        MealPlanRequest(
            target_calories=1800,
            health_goal="maintain",
            available_ingredients=["Đậu phộng"],
            excluded_allergies=["đậu phộng"],
        )


def test_safety_validation_rejects_allergy_and_unreasonable_calorie_estimate():
    plan = valid_plan()
    plan.weekly_plan[0].lunch = "Đậu hũ sốt đậu phộng"
    with pytest.raises(ValueError, match="dị ứng"):
        validate_meal_plan_safety(plan, ["Đậu phộng"], 1800)
    with pytest.raises(ValueError, match="lệch quá xa"):
        validate_meal_plan_safety(valid_plan(calories=2300), [], 1800)
