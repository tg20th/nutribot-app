import asyncio
from app.schemas.nutrition import NutritionCalculationRequest, IngredientInput
from app.services.nutrition_service import NutritionCalculationService


def test_nutrition_calculation_fallback():
    service = NutritionCalculationService(gemini_service=None)
    req = NutritionCalculationRequest(
        servings=2,
        dish_name="Salad đậu phụ",
        ingredients=[
            IngredientInput(name="Đậu phụ", quantity=200, unit="g"),
            IngredientInput(name="Dầu ô liu", quantity=10, unit="ml"),
            IngredientInput(name="Cà chua", quantity=100, unit="g"),
        ],
    )
    res = asyncio.run(service.calculate(req))
    assert res.success is True
    assert res.data.calories > 0
    assert res.data.protein_g > 0
    assert res.data.total_calories > res.data.calories
    assert res.data.summary is not None
