import json

import pytest
from pydantic import ValidationError

from app.planner import (
    MealPlanDishOption,
    MealPlanRequest,
    MealPlanResponse,
    build_meal_plan_prompt,
    prepare_meal_plan_constraints,
    validate_meal_plan_safety,
)


def available_dishes() -> list[MealPlanDishOption]:
    return [
        MealPlanDishOption(dishId=1, name="Oatmeal bowl", calories=350, proteinG=12),
        MealPlanDishOption(dishId=2, name="Tofu mushroom bowl", calories=500, proteinG=25),
        MealPlanDishOption(dishId=3, name="Vegetable soup", calories=250, proteinG=8),
    ]


def valid_plan(calories: int = 1800, lunch_id: int = 2) -> MealPlanResponse:
    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    return MealPlanResponse(
        suggested_menu_title="Balanced seven day menu",
        estimated_daily_calories=calories,
        weekly_plan=[
            {
                "day": weekdays[index],
                "breakfast": {"dishId": 1, "servings": 1},
                "lunch": {"dishId": lunch_id, "servings": 1},
                "dinner": {"dishId": 3, "servings": 1},
            }
            for index in range(7)
        ],
    )


def test_valid_request_builds_a_safe_seven_day_plan():
    request = MealPlanRequest(
        target_calories=1800,
        health_goal="maintain",
        bmi=20.2,
        available_ingredients=["Tofu", "Mushroom", "Greens"],
        excluded_allergies=["Peanuts"],
        available_dishes=available_dishes(),
    )

    constraints = prepare_meal_plan_constraints(request)

    assert request.health_goal == "maintain_weight"
    assert constraints.safe_available_ingredients == ["Tofu", "Mushroom", "Greens"]
    assert validate_meal_plan_safety(
        valid_plan(), constraints.excluded_allergies,
        constraints.target_calories, constraints.available_dishes,
    )


def test_prompt_includes_catalog_ids_and_filters_unsafe_available_ingredients():
    request = MealPlanRequest(
        target_calories=1800,
        health_goal="maintain_weight",
        available_ingredients=["Tofu", "Mushroom", "Peanuts"],
        excluded_allergies=["Peanut"],
        available_dishes=available_dishes(),
    )

    prompt = build_meal_plan_prompt(request)
    payload = json.loads(prompt[prompt.index("{"):])

    assert payload["safe_available_ingredients"] == ["Tofu", "Mushroom"]
    assert payload["excluded_allergies"] == ["Peanut"]
    assert payload["available_dishes"][0]["dishId"] == 1


@pytest.mark.parametrize("unsafe_meal", ["Steamed egg", "Fish soup", "Beef milk", "Honey tea"])
def test_safety_validation_rejects_non_vegan_catalog_dishes(unsafe_meal: str):
    plan = valid_plan(lunch_id=4)
    dishes = available_dishes() + [MealPlanDishOption(dishId=4, name=unsafe_meal, calories=400)]

    with pytest.raises(ValueError, match="không thuần chay"):
        validate_meal_plan_safety(plan, [], 1800, dishes)


@pytest.mark.parametrize("count", [6, 8])
def test_meal_plan_requires_exactly_seven_days(count: int):
    data = valid_plan().model_dump()
    data["weekly_plan"] = data["weekly_plan"][:count] if count < 7 else data["weekly_plan"] + [data["weekly_plan"][0].copy()]

    with pytest.raises(ValidationError):
        MealPlanResponse.model_validate(data)


def test_meal_plan_rejects_duplicate_days():
    data = valid_plan().model_dump()
    data["weekly_plan"][-1]["day"] = "Tuesday"

    with pytest.raises(ValidationError, match="bảy ngày khác nhau"):
        MealPlanResponse.model_validate(data)


def test_meal_plan_rejects_weekdays_out_of_order():
    data = valid_plan().model_dump()
    data["weekly_plan"][0], data["weekly_plan"][1] = data["weekly_plan"][1], data["weekly_plan"][0]

    with pytest.raises(ValidationError, match="Monday through Sunday"):
        MealPlanResponse.model_validate(data)


def test_request_rejects_invalid_calories_and_allergy_only_ingredients():
    with pytest.raises(ValidationError):
        MealPlanRequest(
            target_calories=900, health_goal="maintain",
            available_ingredients=["Mushroom"], available_dishes=available_dishes(),
        )
    with pytest.raises(ValidationError, match="xung đột với dị ứng"):
        MealPlanRequest(
            target_calories=1800, health_goal="maintain",
            available_ingredients=["Peanuts"], excluded_allergies=["Peanut"],
            available_dishes=available_dishes(),
        )


def test_safety_validation_rejects_allergy_and_unreasonable_calorie_estimate():
    plan = valid_plan(lunch_id=4)
    dishes = available_dishes() + [MealPlanDishOption(dishId=4, name="Peanut tofu", calories=400)]
    with pytest.raises(ValueError, match="dị ứng"):
        validate_meal_plan_safety(plan, ["Peanut"], 1800, dishes)
    with pytest.raises(ValueError, match="lệch quá xa"):
        validate_meal_plan_safety(valid_plan(calories=2300), [], 1800, available_dishes())


def test_safety_validation_rejects_dish_id_outside_the_allowed_catalog():
    with pytest.raises(ValueError, match="outside the allowed catalog"):
        validate_meal_plan_safety(valid_plan(lunch_id=9999), [], 1800, available_dishes())
