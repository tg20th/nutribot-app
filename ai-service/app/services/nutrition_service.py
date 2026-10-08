"""NB-16 Nutrition Calculation Service using Gemini with deterministic fallback."""
import json
import logging
from typing import Any

from google.genai import types

from app.schemas.nutrition import (
    NutritionCalculationRequest,
    NutritionCalculationResponse,
    NutritionFacts,
)

logger = logging.getLogger(__name__)

# Fallback basic nutrition lookup table per 100g for common ingredients
NUTRITION_LOOKUP_100G = {
    "đậu phụ": {"calories": 76, "protein": 8.0, "carbs": 1.9, "fat": 4.8, "fiber": 0.3, "sodium": 7},
    "tofu": {"calories": 76, "protein": 8.0, "carbs": 1.9, "fat": 4.8, "fiber": 0.3, "sodium": 7},
    "nấm": {"calories": 22, "protein": 3.1, "carbs": 3.3, "fat": 0.3, "fiber": 1.0, "sodium": 5},
    "nấm hương": {"calories": 34, "protein": 2.2, "carbs": 6.8, "fat": 0.5, "fiber": 2.5, "sodium": 9},
    "cà chua": {"calories": 18, "protein": 0.9, "carbs": 3.9, "fat": 0.2, "fiber": 1.2, "sodium": 5},
    "dầu ô liu": {"calories": 884, "protein": 0.0, "carbs": 0.0, "fat": 100.0, "fiber": 0.0, "sodium": 2},
    "dầu ăn": {"calories": 884, "protein": 0.0, "carbs": 0.0, "fat": 100.0, "fiber": 0.0, "sodium": 0},
    "gạo": {"calories": 130, "protein": 2.7, "carbs": 28.2, "fat": 0.3, "fiber": 0.4, "sodium": 1},
    "cơm": {"calories": 130, "protein": 2.7, "carbs": 28.2, "fat": 0.3, "fiber": 0.4, "sodium": 1},
    "trứng": {"calories": 155, "protein": 13.0, "carbs": 1.1, "fat": 11.0, "fiber": 0.0, "sodium": 124},
    "sữa chua": {"calories": 59, "protein": 10.0, "carbs": 3.6, "fat": 0.4, "fiber": 0.0, "sodium": 36},
    "yến mạch": {"calories": 389, "protein": 16.9, "carbs": 66.3, "fat": 6.9, "fiber": 10.6, "sodium": 2},
    "rau bina": {"calories": 23, "protein": 2.9, "carbs": 3.6, "fat": 0.4, "fiber": 2.2, "sodium": 79},
    "cà rốt": {"calories": 41, "protein": 0.9, "carbs": 9.6, "fat": 0.2, "fiber": 2.8, "sodium": 69},
    "bơ": {"calories": 160, "protein": 2.0, "carbs": 8.5, "fat": 14.7, "fiber": 6.7, "sodium": 7},
    "chuối": {"calories": 89, "protein": 1.1, "carbs": 22.8, "fat": 0.3, "fiber": 2.6, "sodium": 1},
    "hạt chia": {"calories": 486, "protein": 16.5, "carbs": 42.1, "fat": 30.7, "fiber": 34.4, "sodium": 16},
    "muối": {"calories": 0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0, "sodium": 38758},
}


class NutritionCalculationService:
    def __init__(self, gemini_service: Any = None):
        self._gemini_service = gemini_service

    async def calculate(self, request: NutritionCalculationRequest) -> NutritionCalculationResponse:
        servings = max(1, request.servings)
        ingredients_desc = "\n".join(
            f"- {item.name}: {item.quantity} {item.unit}"
            for item in request.ingredients
        )

        prompt = f"""Bạn là chuyên gia dinh dưỡng NutriBot. Hãy tính toán chính xác tổng thành phần dinh dưỡng cho công thức nấu ăn dưới đây:
Món ăn: {request.dish_name or "Món ăn dinh dưỡng"}
Số khẩu phần (servings): {servings}

Danh sách nguyên liệu:
{ingredients_desc}

Yêu cầu:
1. Tính toán giá trị dinh dưỡng TỔNG (total) và TRÊN MỖI KHẨU PHẦN (per serving = total / {servings}).
2. Trả về đúng định dạng JSON có các trường:
- calories: int (calo trên mỗi khẩu phần)
- protein_g: float (đạm trên mỗi khẩu phần, gram, làm tròn 1 chữ số)
- carbs_g: float (tinh bột trên mỗi khẩu phần, gram, làm tròn 1 chữ số)
- fat_g: float (chất béo trên mỗi khẩu phần, gram, làm tròn 1 chữ số)
- fiber_g: float (chất xơ trên mỗi khẩu phần, gram, làm tròn 1 chữ số)
- sodium_mg: float (natri trên mỗi khẩu phần, mg, làm tròn 0 chữ số)
- total_calories: int (tổng calo của toàn bộ công thức)
- summary: string ngắn gọn (ví dụ: "Món ăn giàu protein thực vật và chất xơ, thích hợp cho chế độ ăn thanh đạm.")

Chỉ trả về JSON thuần túy, không có markdown formatting khác."""

        if self._gemini_service:
            try:
                client = self._gemini_service._get_client()
                config = types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                )
                response = await self._gemini_service._generate_with_fallback(
                    client=client,
                    prompt=prompt,
                    config=config,
                )
                text = getattr(response, "text", "")
                if text:
                    data = json.loads(text)
                    facts = NutritionFacts(
                        calories=int(data.get("calories", 0)),
                        protein_g=round(float(data.get("protein_g", 0.0)), 1),
                        carbs_g=round(float(data.get("carbs_g", 0.0)), 1),
                        fat_g=round(float(data.get("fat_g", 0.0)), 1),
                        fiber_g=round(float(data.get("fiber_g", 0.0)), 1),
                        sodium_mg=round(float(data.get("sodium_mg", 0.0)), 0),
                        total_calories=int(data.get("total_calories", data.get("calories", 0) * servings)),
                        summary=data.get("summary"),
                    )
                    return NutritionCalculationResponse(data=facts)
            except Exception as e:
                logger.warning("Gemini nutrition calculation failed (%s); using deterministic estimation fallback", e)

        # Fallback estimation
        return NutritionCalculationResponse(data=self._fallback_estimate(request))

    def _fallback_estimate(self, request: NutritionCalculationRequest) -> NutritionFacts:
        servings = max(1, request.servings)
        tot_cal = 0.0
        tot_pro = 0.0
        tot_carbs = 0.0
        tot_fat = 0.0
        tot_fiber = 0.0
        tot_sodium = 0.0

        for item in request.ingredients:
            qty = item.quantity
            unit = item.unit.lower().strip()
            if unit in ["kg"]:
                grams = qty * 1000
            elif unit in ["ml", "g", "gam"]:
                grams = qty
            elif unit in ["tbsp", "muỗng canh"]:
                grams = qty * 15
            elif unit in ["tsp", "muỗng cà phê"]:
                grams = qty * 5
            elif unit in ["quả", "trái"]:
                grams = qty * 50
            else:
                grams = qty

            factor = grams / 100.0
            name_lower = item.name.lower().strip()

            matched = None
            for key, val in NUTRITION_LOOKUP_100G.items():
                if key in name_lower or name_lower in key:
                    matched = val
                    break

            if not matched:
                matched = {"calories": 80, "protein": 3.0, "carbs": 12.0, "fat": 2.0, "fiber": 2.0, "sodium": 30}

            tot_cal += matched["calories"] * factor
            tot_pro += matched["protein"] * factor
            tot_carbs += matched["carbs"] * factor
            tot_fat += matched["fat"] * factor
            tot_fiber += matched["fiber"] * factor
            tot_sodium += matched["sodium"] * factor

        tot_cal_int = max(0, int(round(tot_cal)))
        return NutritionFacts(
            calories=max(0, int(round(tot_cal / servings))),
            protein_g=max(0.0, round(tot_pro / servings, 1)),
            carbs_g=max(0.0, round(tot_carbs / servings, 1)),
            fat_g=max(0.0, round(tot_fat / servings, 1)),
            fiber_g=max(0.0, round(tot_fiber / servings, 1)),
            sodium_mg=max(0.0, round(tot_sodium / servings, 0)),
            total_calories=tot_cal_int,
            summary="Ước tính dinh dưỡng dựa trên thành phần nguyên liệu tiêu chuẩn.",
        )
