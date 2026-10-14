"""NB-60 recipe extraction contract.

Trích xuất cấu trúc món ăn / nguyên liệu / dinh dưỡng / công thức từ nội dung
Blog hoặc Video đã publish để phục vụ tạo ContentRecipeSuggestion.
"""
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class RecipeExtractionRequest(BaseModel):
    content_id: int = Field(gt=0, description="ID nội dung nguồn")
    content_type: Literal["BLOG", "VIDEO"] = Field(description="Loại nội dung nguồn")
    title: str = Field(min_length=1, max_length=255, description="Tiêu đề nội dung")
    description: str | None = Field(default=None, max_length=4000, description="Mô tả ngắn của nội dung")
    body: str | None = Field(default=None, description="Toàn bộ nội dung bài viết / mô tả video")

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Tiêu đề nội dung không được để trống")
        return stripped


class DishProposal(BaseModel):
    name: str = Field(default="", max_length=150, description="Tên món ăn đề xuất")
    description: str | None = Field(default=None, description="Mô tả ngắn món ăn")
    serving_size: float | None = Field(default=None, ge=0, description="Khối lượng định lượng 1 phần")
    serving_unit: str | None = Field(default=None, max_length=30, description="Đơn vị định lượng (bát/đĩa/phần)")


class NutritionProposal(BaseModel):
    calories: int | None = Field(default=None, ge=0, description="Calo mỗi phần (kcal)")
    protein_g: float | None = Field(default=None, ge=0, description="Đạm mỗi phần (g)")
    carbs_g: float | None = Field(default=None, ge=0, description="Tinh bột mỗi phần (g)")
    fat_g: float | None = Field(default=None, ge=0, description="Chất béo mỗi phần (g)")
    fiber_g: float | None = Field(default=None, ge=0, description="Chất xơ mỗi phần (g)")


class IngredientProposal(BaseModel):
    name: str = Field(min_length=1, max_length=150, description="Tên nguyên liệu")
    quantity: float | None = Field(default=None, ge=0, description="Số lượng nguyên liệu")
    unit: str | None = Field(default=None, max_length=30, description="Đơn vị nguyên liệu (g/ml/thìa/quả)")
    notes: str | None = Field(default=None, max_length=255, description="Ghi chú sơ chế (tùy chọn)")


class RecipeProposal(BaseModel):
    title: str | None = Field(default=None, max_length=200, description="Tên công thức")
    description: str | None = Field(default=None, description="Mô tả công thức")
    prep_time_min: int | None = Field(default=None, ge=0, description="Thời gian chuẩn bị (phút)")
    cook_time_min: int | None = Field(default=None, ge=0, description="Thời gian nấu (phút)")
    servings: int | None = Field(default=None, ge=0, description="Số khẩu phần")
    steps: list[str] = Field(default_factory=list, description="Các bước thực hiện theo thứ tự")


class ModelRecipeExtraction(BaseModel):
    """Schema cho Gemini structured output."""

    dish: DishProposal = Field(default_factory=DishProposal)
    nutrition: NutritionProposal = Field(default_factory=NutritionProposal)
    ingredients: list[IngredientProposal] = Field(default_factory=list)
    recipe: RecipeProposal = Field(default_factory=RecipeProposal)


class RecipeExtractionData(ModelRecipeExtraction):
    """Dữ liệu trích xuất trả về cho Backend."""


class RecipeExtractionResponse(BaseModel):
    success: bool = True
    data: RecipeExtractionData
    message: str = "Trích xuất công thức thành công"
