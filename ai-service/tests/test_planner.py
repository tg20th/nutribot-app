import pytest
from pydantic import ValidationError

from app.planner import MealPlanRequest, MealPlanResponse, build_meal_plan_prompt, validate_meal_plan_safety


def valid_plan() -> MealPlanResponse:
    return MealPlanResponse(
        suggested_menu_title="Thực đơn chay cân bằng 7 ngày",
        estimated_daily_calories=1800,
        weekly_plan=[
            {"day": f"Thứ {index}", "breakfast": "Yến mạch hạt chia", "lunch": "Đậu hũ sốt nấm", "dinner": "Canh rau củ"}
            for index in range(2, 9)
        ],
    )


def test_meal_plan_request_normalises_legacy_goal_and_duplicates():
    request = MealPlanRequest(target_calories=1800, health_goal="maintain", bmi=20.2, available_ingredients=[" Đậu hũ ", "đậu hũ", "Nấm"], excluded_allergies=["Đậu phộng", " đậu phộng "])
    assert request.health_goal == "maintain_weight"
    assert request.available_ingredients == ["Đậu hũ", "Nấm"]
    assert request.excluded_allergies == ["Đậu phộng"]
    assert '"bmi": 20.2' in build_meal_plan_prompt(request)


def test_meal_plan_requires_exactly_seven_unique_days():
    data = valid_plan().model_dump()
    data["weekly_plan"][-1]["day"] = "Thứ 2"
    with pytest.raises(ValidationError):
        MealPlanResponse.model_validate(data)


def test_safety_validation_rejects_allergy_and_animal_products():
    plan = valid_plan()
    validate_meal_plan_safety(plan, ["Đậu phộng"])
    plan.weekly_plan[0].lunch = "Đậu hũ sốt đậu phộng"
    with pytest.raises(ValueError):
        validate_meal_plan_safety(plan, ["Đậu phộng"])
