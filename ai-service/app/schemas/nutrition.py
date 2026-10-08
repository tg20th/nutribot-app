"""NB-16 nutrition calculation contract."""
from pydantic import BaseModel, Field


class IngredientInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    quantity: float = Field(gt=0)
    unit: str = Field(default="g", max_length=20)


class NutritionCalculationRequest(BaseModel):
    servings: int = Field(default=1, ge=1, le=50)
    dish_name: str | None = Field(default=None, max_length=255)
    ingredients: list[IngredientInput] = Field(min_length=1)


class NutritionFacts(BaseModel):
    calories: int = Field(ge=0, description="Calories (kcal) per serving")
    protein_g: float = Field(ge=0, description="Protein (g) per serving")
    carbs_g: float = Field(ge=0, description="Carbohydrates (g) per serving")
    fat_g: float = Field(ge=0, description="Fat (g) per serving")
    fiber_g: float = Field(ge=0, description="Fiber (g) per serving")
    sodium_mg: float = Field(ge=0, description="Sodium (mg) per serving")
    total_calories: int = Field(ge=0, description="Total calories for entire recipe")
    summary: str | None = None


class NutritionCalculationResponse(BaseModel):
    success: bool = True
    data: NutritionFacts
    message: str = "Tính toán dinh dưỡng thành công"
