"""Tích hợp Google Gemini bằng SDK google-genai."""

import logging
import time
from typing import Any

from google import genai
from google.genai import errors, types
from pydantic import ValidationError

from app.config import Settings
from app.exceptions import AIConfigurationError, AIProviderUnavailableError
from app.planner import (
    MealPlanRequest,
    MealPlanResponse,
    PLANNER_SYSTEM_INSTRUCTION,
    build_meal_plan_prompt,
    prepare_meal_plan_constraints,
    validate_meal_plan_safety,
)
from app.prompts import SYSTEM_INSTRUCTION, build_user_prompt
from app.schemas.chat import ChatRequest, ChatResponse, GeminiChatResult


logger = logging.getLogger(__name__)


class GeminiService:
    def __init__(self, settings: Settings, client: Any | None = None) -> None:
        self._settings = settings
        self._client = client

    def _get_client(self) -> Any:
        if self._client is not None:
            return self._client
        if not self._settings.gemini_configured:
            raise AIConfigurationError(
                "AI service chưa được cấu hình GEMINI_API_KEY"
            )
        self._client = genai.Client(
            api_key=self._settings.gemini_api_key,
            http_options=types.HttpOptions(
                timeout=int(self._settings.gemini_timeout_seconds * 1_000)
            ),
        )
        return self._client

    @property
    def model_name(self): return self._settings.gemini_model

    async def moderate_content(self, request):
        """Return structured moderation fields; supports multimodal thumbnail evaluation."""
        from app.schemas.moderation import ModelModeration
        client = self._get_client()

        image_part = None
        if request.thumbnail_url and request.thumbnail_url.strip():
            import httpx
            try:
                async with httpx.AsyncClient(timeout=4.0) as http_client:
                    resp = await http_client.get(request.thumbnail_url.strip())
                    if resp.status_code == 200:
                        mime = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
                        if not mime.startswith("image/"):
                            mime = "image/jpeg"
                        image_part = types.Part.from_bytes(data=resp.content, mime_type=mime)
                    else:
                        logger.warning("Không thể tải thumbnail từ URL (HTTP %s): %s", resp.status_code, request.thumbnail_url)
                        return ModelModeration(
                            decision="NEEDS_REVIEW",
                            reason="Không thể tải ảnh thumbnail (HTTP error), cần Admin duyệt thủ công",
                            confidence=0.0,
                            categories=["AMBIGUOUS"]
                        ).model_dump()
            except Exception as e:
                logger.warning("Lỗi kết nối tải thumbnail: %s", e)
                return ModelModeration(
                    decision="NEEDS_REVIEW",
                    reason="Lỗi tải ảnh thumbnail kiểm duyệt, cần Admin duyệt thủ công",
                    confidence=0.0,
                    categories=["AMBIGUOUS"]
                ).model_dump()

        prompt_text = (
            "You are the content moderation AI for NutriBot, a vegetarian & nutrition community platform. "
            "Policy instructions: "
            "1. VEGETARIAN ACCEPTANCE (BROAD): NutriBot supports all vegetarian diets including VEGAN, LACTO, OVO, and LACTO_OVO. "
            "   - Plant foods, tofu (đậu phụ), tempeh, mushrooms, vegetables, fruits, grains, nuts, and seeds are 100% valid. "
            "   - Dairy products (milk, cheese, yogurt, butter) and eggs are fully ACCEPTABLE vegetarian foods on NutriBot. "
            "   - IMPORTANT: White cubes or crumbles in salads and dishes are typically TOFU (đậu phụ) or cheese/dairy. They are completely SAFE, VALID, and must be treated as acceptable vegetarian food. Do NOT treat tofu, cheese, or eggs as violations. "
            "   - ONLY flag NON_VEGETARIAN_CONTENT or NON_VEGETARIAN_IMAGE if animal slaughter flesh (beef, pork, chicken, duck, poultry, fish, shrimp, seafood) is explicitly promoted or shown. "
            "2. SAFETY: "
            "   - Flag SENSITIVE_IMAGE for NSFW, nudity, violence, or gore in attached images. "
            "   - Flag MEDICAL_CLAIM or UNSAFE_NUTRITION_ADVICE for dangerous health claims (e.g. curing cancer without evidence). "
            "   - Flag SPAM or OFF_TOPIC for promotional crypto, gambling, commercial spam. "
            "3. DECISION CRITERIA: "
            "   - Set decision='APPROVE' with confidence >= 0.95 and categories=['SAFE'] for genuine healthy vegetarian recipes, salads, tofu dishes, or nutrition guides. "
            "   - Set decision='REJECT' ONLY when clear prohibited items (real animal meat/seafood, NSFW, spam, dangerous medical cure claims) are detected. "
            "   - Set decision='NEEDS_REVIEW' only when genuine ambiguity exists. "
            "4. IMAGE-CONTENT RELEVANCE: "
            "   - If a thumbnail image is present, check whether the image shows food, ingredients, or a culinary dish RELEVANT to the recipe/caption in the title, description, or body. "
            "   - If the image depicts completely unrelated objects (e.g., electronic gadgets, vehicles, random memes, unrelated animals, unrelated selfies) or a completely conflicting dish, flag UNRELATED_IMAGE or OFF_TOPIC. "
            "   - Set decision='REJECT' (if blatantly unrelated non-food spam/objects) or decision='NEEDS_REVIEW' with a clear explanation in 'reason' in Vietnamese (e.g. 'Ảnh thumbnail không liên quan đến món ăn trong bài viết'). "
            "   - If the image depicts the described dish, matching ingredients, or a plausible variation/serving of the food, it is SAFE and relevant. "
            "Return structured JSON matching ModelModeration schema. "
            f"Content: {request.model_dump_json()}"
        )
        contents = [prompt_text, image_part] if image_part is not None else prompt_text

        config = types.GenerateContentConfig(response_mime_type="application/json", response_schema=ModelModeration, temperature=0)
        response = await self._generate_with_fallback(client, contents, config)
        parsed = getattr(response, "parsed", None)
        return (parsed if isinstance(parsed, ModelModeration) else ModelModeration.model_validate(parsed if parsed is not None else getattr(response, "text", None))).model_dump()

    async def verify_image_relevance(self, request):
        """Verify whether an image matches the food/recipe caption and context."""
        from app.schemas.image_verification import ImageRelevanceRequest, ImageRelevanceResponse
        import httpx
        client = self._get_client()

        image_url = request.image_url.strip()
        image_part = None
        try:
            async with httpx.AsyncClient(timeout=6.0) as http_client:
                resp = await http_client.get(image_url)
                if resp.status_code == 200:
                    mime = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
                    if not mime.startswith("image/"):
                        mime = "image/jpeg"
                    image_part = types.Part.from_bytes(data=resp.content, mime_type=mime)
                else:
                    return ImageRelevanceResponse(
                        is_relevant=False,
                        confidence=0.0,
                        detected_dish="Không thể tải ảnh",
                        match_status="UNRECOGNIZED",
                        reason=f"Không thể tải ảnh từ URL (HTTP {resp.status_code})",
                        is_food=False,
                        is_vegetarian=None,
                    )
        except Exception as e:
            return ImageRelevanceResponse(
                is_relevant=False,
                confidence=0.0,
                detected_dish="Lỗi kết nối",
                match_status="UNRECOGNIZED",
                reason=f"Lỗi kết nối khi tải ảnh: {str(e)}",
                is_food=False,
                is_vegetarian=None,
            )

        ingredients_text = ", ".join(request.recipe_ingredients) if request.recipe_ingredients else "Không có danh sách cụ thể"
        prompt_text = (
            "You are an expert culinary and nutrition AI vision evaluator for NutriBot. "
            "Task: Determine if the provided image is RELEVANT to the recipe, caption, and dish described in the text. "
            "\nContext from user:\n"
            f"- Title: {request.title or 'Không có'}\n"
            f"- Caption / Description: {request.caption}\n"
            f"- Key ingredients: {ingredients_text}\n\n"
            "Evaluation Criteria:\n"
            "1. Food Detection: Is the image genuinely a food, beverage, ingredient, or culinary dish (is_food=true)? "
            "   If it depicts non-food objects (e.g. cars, smartphones, memes, screenshots, clothes, unrelated people), set is_food=false, is_relevant=false, match_status='MISMATCH'.\n"
            "2. Dish / Ingredient Matching:\n"
            "   - 'MATCH': The dish in the image clearly represents the dish/recipe described in the caption or contains primary ingredients of the recipe.\n"
            "   - 'PARTIAL_MATCH': The dish belongs to the same family or cuisine (e.g. salad vs salad bowl, noodle soup, general vegetarian plate) or shares key components, even if minor garnishes differ.\n"
            "   - 'MISMATCH': The image shows an entirely different dish or non-food item (e.g. caption describes a fruit salad or smoothie, but image is pizza or steak, or non-food).\n"
            "3. Vegetarian Check (is_vegetarian):\n"
            "   - Plant foods, vegetables, fruits, tofu, mushrooms, grains, nuts, dairy (milk/cheese), and eggs are 100% vegetarian on NutriBot.\n"
            "   - Meat, poultry, fish, seafood are NOT vegetarian.\n"
            "4. Reason: Provide a clear, natural, helpful explanation in Vietnamese (Tiếng Việt) explaining what is detected in the image and why it matches or mismatches the caption.\n\n"
            "Return JSON matching the ImageRelevanceResponse schema."
        )

        contents = [prompt_text, image_part]
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ImageRelevanceResponse,
            temperature=0.1,
        )
        response = await self._generate_with_fallback(client, contents, config)
        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, ImageRelevanceResponse):
            return parsed
        if parsed is not None:
            return ImageRelevanceResponse.model_validate(parsed)
        text_content = getattr(response, "text", None)
        return ImageRelevanceResponse.model_validate_json(text_content)

    async def chat(self, request: ChatRequest) -> ChatResponse:
        client = self._get_client()
        prompt = build_user_prompt(
            request,
            max_history_messages=self._settings.max_history_messages,
        )
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.35,
            max_output_tokens=1_000,
            response_mime_type="application/json",
            response_schema=GeminiChatResult,
        )

        started_at = time.perf_counter()
        try:
            response = await self._generate_with_fallback(client, prompt, config)
            result = self._parse_response(response)
            usage = getattr(response, "usage_metadata", None)
            token_usage = getattr(usage, "total_token_count", None) if usage else None
            logger.info(
                "Gemini chat latency_ms=%d token_usage=%s",
                (time.perf_counter() - started_at) * 1000,
                token_usage if token_usage is not None else "unavailable",
            )
            return ChatResponse.model_validate(result.model_dump())
        except AIProviderUnavailableError:
            raise
        except Exception as exc:
            logger.exception("Gemini không thể xử lý yêu cầu: %s", type(exc).__name__)
            raise AIProviderUnavailableError(
                "NutriBot đang bận, vui lòng thử lại sau"
            ) from exc

    async def generate_meal_plan(self, request: MealPlanRequest) -> MealPlanResponse:
        client = self._get_client()
        constraints = prepare_meal_plan_constraints(request)
        config = types.GenerateContentConfig(
            system_instruction=PLANNER_SYSTEM_INSTRUCTION,
            temperature=0.25,
            max_output_tokens=2_500,
            response_mime_type="application/json",
            response_schema=MealPlanResponse,
        )
        try:
            response = await self._generate_with_fallback(
                client, build_meal_plan_prompt(constraints), config
            )
            plan = self._parse_meal_plan_response(response)
            return validate_meal_plan_safety(
                plan,
                constraints.excluded_allergies,
                constraints.target_calories,
                constraints.available_dishes,
            )
        except AIProviderUnavailableError:
            raise
        except Exception as exc:
            logger.exception("Gemini could not generate meal plan: %s", type(exc).__name__)
            raise AIProviderUnavailableError(
                "NutriBot khong the tao thuc don an toan luc nay, vui long thu lai"
            ) from exc

    async def _generate_with_fallback(
        self,
        client: Any,
        prompt: Any,
        config: types.GenerateContentConfig,
    ) -> Any:
        try:
            return await client.aio.models.generate_content(
                model=self._settings.gemini_model,
                contents=prompt,
                config=config,
            )
        except errors.APIError as exc:
            fallback_model = self._settings.gemini_fallback_model
            # A 429 is an exhausted quota: retrying only adds latency.
            transient_statuses = {500, 502, 503, 504}
            if (
                exc.code not in transient_statuses
                or not fallback_model
                or fallback_model == self._settings.gemini_model
            ):
                raise
            logger.warning(
                "Model %s tạm thời không sẵn sàng (%s); chuyển sang %s",
                self._settings.gemini_model,
                exc.code,
                fallback_model,
            )
            return await client.aio.models.generate_content(
                model=fallback_model,
                contents=prompt,
                config=config,
            )

    @staticmethod
    def _parse_meal_plan_response(response: Any) -> MealPlanResponse:
        parsed = getattr(response, "parsed", None)
        try:
            if isinstance(parsed, MealPlanResponse):
                return parsed
            if parsed is not None:
                return MealPlanResponse.model_validate(parsed)
            content = getattr(response, "text", None)
            if not content:
                raise ValueError("Gemini returned empty content")
            return MealPlanResponse.model_validate_json(content)
        except (ValidationError, ValueError) as exc:
            raise AIProviderUnavailableError(
                "NutriBot nhan duoc phan hoi thuc don khong hop le, vui long thu lai"
            ) from exc

    @staticmethod
    def _parse_response(response: Any) -> GeminiChatResult:
        parsed = getattr(response, "parsed", None)
        try:
            if isinstance(parsed, GeminiChatResult):
                return parsed
            if parsed is not None:
                return GeminiChatResult.model_validate(parsed)
            text = getattr(response, "text", None)
            if not text:
                raise ValueError("Gemini trả về nội dung rỗng")
            return GeminiChatResult.model_validate_json(text)
        except (ValidationError, ValueError) as exc:
            raise AIProviderUnavailableError(
                "NutriBot nhận được phản hồi không hợp lệ, vui lòng thử lại"
            ) from exc
