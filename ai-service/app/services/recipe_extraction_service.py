"""NB-60 recipe extraction service using Gemini structured output."""
import logging
from typing import Any

from google.genai import types

from app.exceptions import AIServiceError, AIProviderUnavailableError
from app.schemas.recipe_extraction import (
    ModelRecipeExtraction,
    RecipeExtractionData,
    RecipeExtractionRequest,
    RecipeExtractionResponse,
)

logger = logging.getLogger(__name__)


class RecipeExtractionService:
    """Trích xuất công thức có cấu trúc từ nội dung đã publish."""

    def __init__(self, gemini_service: Any = None):
        self._gemini_service = gemini_service

    async def extract(self, request: RecipeExtractionRequest) -> RecipeExtractionResponse:
        gemini = self._gemini_service
        if gemini is None:
            raise AIProviderUnavailableError("AI service chưa sẵn sàng để trích xuất công thức")

        prompt = self._build_prompt(request)
        try:
            client = gemini._get_client()
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ModelRecipeExtraction,
                temperature=0.2,
            )
            response = await gemini._generate_with_fallback(
                client=client,
                prompt=prompt,
                config=config,
            )
            model = self._parse_response(response)
        except AIServiceError:
            raise
        except Exception as exc:
            logger.exception(
                "Gemini không thể trích xuất công thức: %s", type(exc).__name__
            )
            raise AIProviderUnavailableError(
                "NutriBot không thể trích xuất công thức lúc này, vui lòng thử lại"
            ) from exc

        return RecipeExtractionResponse(data=RecipeExtractionData(**model.model_dump()))

    @staticmethod
    def _parse_response(response: Any) -> ModelRecipeExtraction:
        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, ModelRecipeExtraction):
            return parsed
        if parsed is not None:
            return ModelRecipeExtraction.model_validate(parsed)
        text = getattr(response, "text", None)
        if not text:
            raise ValueError("Gemini trả về nội dung rỗng")
        return ModelRecipeExtraction.model_validate_json(text)

    @staticmethod
    def _build_prompt(request: RecipeExtractionRequest) -> str:
        return (
            "Bạn là AI trích xuất công thức cho NutriBot, nền tảng cộng đồng ẩm thực chay & dinh dưỡng.\n"
            "Nhiệm vụ: Đọc nội dung Blog/Video dưới đây và trích xuất thông tin công thức có cấu trúc.\n"
            "CHỈ trích xuất khi nội dung thực sự mô tả một MÓN ĂN / CÔNG THỨC / ĐỒ UỐNG cụ thể. "
            "Nếu nội dung không phải công thức (chia sẻ quan điểm, kiến thức chung, không có món ăn rõ ràng) "
            "thì trả về dish.name rỗng và ingredients rỗng.\n"
            "Không bịa thông tin không có trong bài; trường không xác định để null.\n\n"
            f"Loại nội dung: {request.content_type}\n"
            f"Tiêu đề: {request.title}\n"
            f"Mô tả: {request.description or 'Không có'}\n"
            f"Nội dung:\n{request.body or 'Không có'}\n\n"
            "Yêu cầu đầu ra JSON gồm: dish{name, description, serving_size, serving_unit}, "
            "nutrition{calories, protein_g, carbs_g, fat_g, fiber_g}, "
            "ingredients[{name, quantity, unit, notes}], "
            "recipe{title, description, prep_time_min, cook_time_min, servings, steps[]}. "
            "Chỉ trả về JSON thuần túy, không markdown."
        )
