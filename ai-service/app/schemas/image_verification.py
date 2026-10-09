"""NB-64 image-to-content relevance verification contract."""
from typing import Literal
from pydantic import BaseModel, Field

MatchStatus = Literal["MATCH", "PARTIAL_MATCH", "MISMATCH", "UNRECOGNIZED"]


class ImageRelevanceRequest(BaseModel):
    image_url: str = Field(min_length=1, description="URL ảnh món ăn cần xác minh")
    caption: str = Field(min_length=1, max_length=2000, description="Mô tả / Caption / Tên món ăn cần đối soát")
    title: str | None = Field(default=None, max_length=255, description="Tiêu đề bài viết (tùy chọn)")
    recipe_ingredients: list[str] = Field(default_factory=list, description="Danh sách nguyên liệu chính (nếu có)")


class ImageRelevanceResponse(BaseModel):
    is_relevant: bool = Field(description="True nếu ảnh phù hợp hoặc liên quan đến món ăn và nội dung trong caption")
    confidence: float = Field(ge=0.0, le=1.0, description="Độ tin cậy của đánh giá (0.0 - 1.0)")
    detected_dish: str = Field(description="Mô tả món ăn hoặc đối tượng AI nhận diện được trong bức ảnh")
    match_status: MatchStatus = Field(description="Mức độ khớp giữa ảnh và caption")
    reason: str = Field(min_length=1, max_length=500, description="Giải thích chi tiết bằng tiếng Việt lý do tại sao ảnh có hoặc không liên quan")
    is_food: bool = Field(description="Bức ảnh có phải là đồ ăn / thức uống hay không")
    is_vegetarian: bool | None = Field(default=None, description="Ảnh có phù hợp tiêu chuẩn món chay của NutriBot không")
