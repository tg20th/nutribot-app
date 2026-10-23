"""Tích hợp Google Gemini bằng SDK google-genai."""

import asyncio
import inspect
import json
import logging
import math
from pathlib import Path
import re
import tempfile
import time
from typing import Any

import httpx
from google import genai
from google.genai import errors, types
from pydantic import ValidationError

from app.config import Settings
from app.exceptions import (
    AIConfigurationError,
    AIProviderUnavailableError,
    AIResponseInvalidError,
    AIQuotaExceededError,
)
from app.planner import (
    MealPlanRequest,
    MealPlanResponse,
    PLANNER_SYSTEM_INSTRUCTION,
    build_meal_plan_prompt,
    prepare_meal_plan_constraints,
    validate_meal_plan_safety,
)
from app.prompts import (
    IMAGE_CONTEXT_FOLLOWUP_SYSTEM_INSTRUCTION,
    IMAGE_SYSTEM_INSTRUCTION,
    VIDEO_CONTEXT_FOLLOWUP_SYSTEM_INSTRUCTION,
    VIDEO_SYSTEM_INSTRUCTION,
    SYSTEM_INSTRUCTION,
    build_image_prompt,
    build_video_prompt,
    build_user_prompt,
)
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    GeminiChatResult,
    GeminiTextChatResult,
    GeminiVideoExtraction,
    VideoAnalysis,
    VideoIngredient,
    VideoSource,
    VideoStep,
    SuggestedAction,
)
from app.services.model_router import (
    IMAGE_TASK,
    TEXT_TASK,
    VIDEO_TASK,
    GeminiModelRouter,
)


logger = logging.getLogger(__name__)


_UNAMBIGUOUS_INGREDIENT_FIXES = {
    "tofu": "đậu phụ",
    "peanut": "đậu phộng",
    "đủ đủ": "đu đủ",
}
_UNCERTAINTY_MARKERS = (
    "có thể",
    "có khả năng",
    "có lẽ",
    "không chắc",
    "khó phân biệt",
    "chưa thể xác định",
)
_RECOMMENDATION_MARKERS = (
    "nấu",
    "làm món",
    "món gì",
    "công thức",
    "phù hợp",
    "chế độ ăn",
    "dinh dưỡng",
    "bổ sung",
    "thay thế",
    "gợi ý",
    "ăn gì",
)
_VIDEO_CAPABLE_MODELS = {
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
}


def _normalize_ingredient_name(value: str) -> str:
    normalized = value.strip()
    for source, replacement in _UNAMBIGUOUS_INGREDIENT_FIXES.items():
        normalized = re.sub(
            re.escape(source), replacement, normalized, flags=re.IGNORECASE
        )
    return normalized


def _normalize_ingredient_list(values: list[str] | None) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values or []:
        clean_value = _normalize_ingredient_name(value)
        key = clean_value.casefold()
        if clean_value and key not in seen:
            normalized.append(clean_value)
            seen.add(key)
    return normalized


def _has_nearby_uncertainty(reply: str, ingredient: str) -> bool:
    reply_lower = _normalize_ingredient_name(reply).casefold()
    ingredient_lower = ingredient.casefold()
    clauses = re.split(r"[.;!?]\s+|;\s*", reply_lower)
    for clause in clauses:
        if ingredient_lower in clause and any(
            marker in clause for marker in _UNCERTAINTY_MARKERS
        ):
            return True
    return False


def _is_recommendation_request(message: str) -> bool:
    message_lower = message.casefold().strip()
    return any(marker in message_lower for marker in _RECOMMENDATION_MARKERS)


def _build_image_context(
    recognized: list[str], uncertain: list[str], warnings: list[str]
) -> str:
    parts: list[str] = []
    if recognized:
        parts.append("Nhìn thấy rõ: " + ", ".join(recognized) + ".")
    if uncertain:
        parts.append("Chưa chắc chắn: " + ", ".join(uncertain) + ".")
    if warnings:
        parts.append("Lưu ý: " + " ".join(warnings))
    return " ".join(parts) or "Chưa xác định được nguyên liệu từ hình ảnh."


def _refine_image_result(result: GeminiChatResult, request: ChatRequest) -> GeminiChatResult:
    recognized = _normalize_ingredient_list(result.recognized_ingredients)
    uncertain = _normalize_ingredient_list(result.uncertain_ingredients)
    warnings = _normalize_ingredient_list(result.warnings)

    uncertain_keys = {value.casefold() for value in uncertain}
    moved_to_uncertain: list[str] = []
    kept_recognized: list[str] = []
    for ingredient in recognized:
        if ingredient.casefold() in uncertain_keys or _has_nearby_uncertainty(result.reply, ingredient):
            if ingredient.casefold() not in uncertain_keys:
                uncertain.append(ingredient)
                uncertain_keys.add(ingredient.casefold())
            moved_to_uncertain.append(ingredient)
        else:
            kept_recognized.append(ingredient)

    reply = result.reply
    if moved_to_uncertain and not any(
        marker in reply.casefold() for marker in _UNCERTAINTY_MARKERS
    ):
        reply += " Lưu ý: các nguyên liệu này chưa thể xác nhận chắc chắn chỉ từ hình ảnh."

    recommendations = (
        result.recommendations
        if _is_recommendation_request(request.message)
        else []
    )
    image_context = _build_image_context(kept_recognized, uncertain, warnings)
    return result.model_copy(
        update={
            "reply": reply,
            "recommendations": recommendations,
            "recognized_ingredients": kept_recognized,
            "uncertain_ingredients": uncertain,
            "warnings": warnings,
            "image_context": image_context,
            "suggested_actions": ([SuggestedAction(type="COOKING_INSTRUCTIONS", label="Show cooking instructions")] if kept_recognized else []),
        }
    )


class GeminiService:
    def __init__(self, settings: Settings, client: Any | None = None) -> None:
        self._settings = settings
        self._client = client
        self._image_client = None
        self._video_client = None
        self._model_router = GeminiModelRouter(settings)

    def _get_client(self, image_request: bool = False, video_request: bool = False) -> Any:
        if self._client is not None:
            return self._client
        if image_request and self._image_client is not None:
            return self._image_client
        if video_request and self._video_client is not None:
            return self._video_client
        if not self._settings.gemini_configured:
            raise AIConfigurationError(
                "AI service chưa được cấu hình GEMINI_API_KEY"
            )
        http_options = types.HttpOptions(
            timeout=int(
                (
                    self._settings.gemini_image_attempt_timeout_seconds
                    if image_request
                    else (
                        self._settings.gemini_video_attempt_timeout_seconds
                        if video_request
                        else self._settings.gemini_timeout_seconds
                    )
                )
                * 1_000
            )
        )
        # Application-level fallback owns transient recovery. Disable the
        # SDK's default retry set (which includes 429) so quota failures are
        # surfaced immediately and never consume hidden extra attempts.
        http_options.retry_options = types.HttpRetryOptions(attempts=1)
        client = genai.Client(
            api_key=self._settings.gemini_api_key,
            http_options=http_options,
        )
        if image_request:
            self._image_client = client
        elif video_request:
            self._video_client = client
        else:
            self._client = client
        return client

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

    @staticmethod
    def _has_context(request: ChatRequest, marker: str) -> bool:
        return any(
            message.sender == "ASSISTANT" and marker in message.content.casefold()
            for message in request.conversation_history
        )

    async def _maybe_await(self, value: Any) -> Any:
        return await value if inspect.isawaitable(value) else value

    async def _upload_video_part(
        self,
        client: Any,
        request: ChatRequest,
        telemetry: dict[str, Any],
    ) -> tuple[Any, str]:
        assert request.video is not None
        video = request.video
        video_bytes = video.decoded_bytes()
        telemetry["size_bytes"] = len(video_bytes)
        telemetry["duration_seconds"] = "unverified"
        if len(video_bytes) > self._settings.gemini_video_max_bytes:
            raise AIProviderUnavailableError("Video vượt quá kích thước ứng dụng cho phép")

        suffix = "." + video.mime_type.split("/", 1)[1].replace("x-", "")
        temporary_path: str | None = None
        uploaded: Any | None = None
        ready = False
        upload_started: float | None = None
        processing_started: float | None = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary:
                temporary.write(video_bytes)
                temporary_path = temporary.name
            telemetry["stage"] = "upload"
            upload_config = types.UploadFileConfig(mime_type=video.mime_type)
            upload_started = time.perf_counter()
            uploaded = await self._maybe_await(
                client.aio.files.upload(file=temporary_path, config=upload_config)
            )
            telemetry["upload_duration_ms"] = round((time.perf_counter() - upload_started) * 1000)
            file_name = getattr(uploaded, "name", None)
            file_uri = getattr(uploaded, "uri", None)
            if not file_name or not file_uri:
                raise AIProviderUnavailableError("Gemini không trả về định danh video hợp lệ")

            telemetry["stage"] = "processing"
            processing_started = time.perf_counter()
            deadline = time.monotonic() + self._settings.gemini_video_max_poll_seconds
            current = uploaded
            while True:
                state = getattr(getattr(current, "state", None), "name", None) or str(
                    getattr(current, "state", "")
                ).upper()
                if state == "ACTIVE":
                    ready = True
                    telemetry["processing_duration_ms"] = round((time.perf_counter() - processing_started) * 1000)
                    return types.Part.from_uri(
                        file_uri=file_uri,
                        mime_type=getattr(uploaded, "mime_type", None) or video.mime_type,
                    ), file_name
                if state == "FAILED":
                    raise AIProviderUnavailableError("Gemini không xử lý được video đã tải lên")
                if time.monotonic() >= deadline:
                    raise AIProviderUnavailableError("Gemini xử lý video quá lâu, vui lòng thử lại sau")
                await asyncio.sleep(self._settings.gemini_video_poll_interval_seconds)
                current = await self._maybe_await(client.aio.files.get(name=file_name))
        finally:
            if processing_started is not None and "processing_duration_ms" not in telemetry:
                telemetry["processing_duration_ms"] = round((time.perf_counter() - processing_started) * 1000)
            if uploaded is not None and not ready:
                failed_name = getattr(uploaded, "name", None)
                if failed_name:
                    try:
                        await self._delete_uploaded_video(client, failed_name, telemetry)
                    except Exception as exc:
                        logger.warning(
                            "Gemini video cleanup after upload failure failed file_name=%s error_type=%s",
                            failed_name,
                            type(exc).__name__,
                        )
            if temporary_path:
                try:
                    Path(temporary_path).unlink(missing_ok=True)
                except OSError:
                    logger.warning("Video temporary file cleanup failed")

    async def _delete_uploaded_video(
        self, client: Any, file_name: str | None, telemetry: dict[str, Any]
    ) -> None:
        if not file_name:
            return
        try:
            telemetry["stage"] = "cleanup"
            cleanup_timeout = min(5.0, self._settings.gemini_video_attempt_timeout_seconds)
            await asyncio.wait_for(
                self._maybe_await(client.aio.files.delete(name=file_name)),
                timeout=cleanup_timeout,
            )
        except Exception as exc:
            logger.warning(
                "Gemini video cleanup failed file_name=%s error_type=%s",
                file_name,
                type(exc).__name__,
            )

    async def _chat_with_video(self, request: ChatRequest) -> ChatResponse:
        client = self._get_client(video_request=True)
        started_at = time.perf_counter()
        video_deadline = asyncio.get_running_loop().time() + self._settings.gemini_video_timeout_seconds
        telemetry: dict[str, Any] = {
            "models": [],
            "calls": 0,
            "errors": [],
            "source": "youtube_url" if request.video_url else "upload",
            "stage": "validation",
        }
        remote_file_name: str | None = None
        try:
            if request.video_url:
                telemetry["stage"] = "provider_input"
                # GenerateContent cannot infer a MIME type from a YouTube URL.
                # The provider accepts the public URL as the URI and uses this
                # explicit type to route it through video understanding.
                video_part = types.Part.from_uri(
                    file_uri=request.video_url,
                    mime_type="video/mp4",
                )
            else:
                video_part, remote_file_name = await self._upload_video_part(
                    client, request, telemetry
                )
            prompt = build_video_prompt(
                request, max_history_messages=self._settings.max_history_messages
            )
            config = types.GenerateContentConfig(
                system_instruction=VIDEO_SYSTEM_INSTRUCTION,
                temperature=0.2,
                max_output_tokens=2_000,
                response_mime_type="application/json",
                response_schema=GeminiVideoExtraction,
            )
            telemetry["stage"] = "inference"
            inference_started = time.perf_counter()
            response = await self._generate_with_fallback(
                client,
                [video_part, prompt],
                config,
                telemetry=telemetry,
                fallback_on_timeout=True,
                video_request=True,
                task=VIDEO_TASK,
                deadline=video_deadline,
            )
            telemetry["inference_duration_ms"] = round((time.perf_counter() - inference_started) * 1000)
            extraction = self._parse_video_extraction(response)
            video_source = await self._youtube_source(request.video_url) if request.video_url else None
            result = self._build_video_result(extraction, video_source)
            finish_reason, token_usage = self._response_telemetry(response)
            logger.info(
                "Gemini video completed source=%s size_bytes=%s duration=%s upload_ms=%s processing_ms=%s inference_ms=%s models=%s calls=%d latency_ms=%d finish_reason=%s token_usage=%s",
                telemetry["source"], telemetry.get("size_bytes", "unknown"),
                telemetry.get("duration_seconds", "unverified"),
                telemetry.get("upload_duration_ms", "n/a"), telemetry.get("processing_duration_ms", "n/a"),
                telemetry.get("inference_duration_ms", "n/a"),
                telemetry["models"], telemetry["calls"],
                (time.perf_counter() - started_at) * 1000,
                finish_reason,
                token_usage if token_usage is not None else "unavailable",
            )
            return ChatResponse.model_validate(result.model_dump(exclude_none=True))
        except (AIProviderUnavailableError, AIResponseInvalidError):
            raise
        except asyncio.TimeoutError as exc:
            telemetry["stage"] = "timeout"
            logger.warning(
                "Gemini video timed out source=%s models=%s calls=%d latency_ms=%d",
                telemetry["source"], telemetry["models"], telemetry["calls"],
                (time.perf_counter() - started_at) * 1000,
            )
            raise AIProviderUnavailableError(
                "NutriBot xử lý video quá lâu, vui lòng thử lại sau"
            ) from exc
        except Exception as exc:
            telemetry["stage"] = "failure"
            logger.exception(
                "Gemini video failed source=%s error_type=%s latency_ms=%d",
                telemetry["source"], type(exc).__name__,
                (time.perf_counter() - started_at) * 1000,
            )
            raise AIProviderUnavailableError(
                "NutriBot không thể phân tích video lúc này, vui lòng thử lại sau"
            ) from exc
        finally:
            await self._delete_uploaded_video(client, remote_file_name, telemetry)

    async def chat(self, request: ChatRequest) -> ChatResponse:
        if request.video_url is not None or request.video is not None:
            try:
                return await asyncio.wait_for(
                    self._chat_with_video(request),
                    timeout=self._settings.gemini_video_timeout_seconds,
                )
            except asyncio.TimeoutError as exc:
                raise AIProviderUnavailableError(
                    "NutriBot xử lý video quá lâu, vui lòng thử lại sau"
                ) from exc

        is_image_request = request.image is not None
        has_image_context = self._has_context(request, "image_context:") or self._has_context(
            request, "recognized_ingredients:"
        )
        has_video_context = self._has_context(request, "video_context:") or self._has_context(
            request, "video_analysis:"
        )
        # A follow-up only needs the saved semantic media context. Media
        # controls, media deadlines and media-capable routing are reserved for
        # a new upload/URL request so recipe suggestions do not consume the
        # scarcer media model path.
        use_image_controls = is_image_request
        use_video_controls = request.video_url is not None or request.video is not None
        task = (
            IMAGE_TASK
            if use_image_controls
            else VIDEO_TASK
            if use_video_controls
            else TEXT_TASK
        )
        client = self._get_client(
            image_request=use_image_controls,
            video_request=use_video_controls,
        )
        prompt_builder = (
            build_image_prompt
            if is_image_request
            else (build_video_prompt if has_video_context else build_user_prompt)
        )
        prompt = prompt_builder(
            request,
            max_history_messages=self._settings.max_history_messages,
        )
        config = types.GenerateContentConfig(
            system_instruction=(
                IMAGE_SYSTEM_INSTRUCTION
                if is_image_request
                else (
                    IMAGE_CONTEXT_FOLLOWUP_SYSTEM_INSTRUCTION
                    if has_image_context
                    else (
                        VIDEO_CONTEXT_FOLLOWUP_SYSTEM_INSTRUCTION
                        if has_video_context
                        else SYSTEM_INSTRUCTION
                    )
                )
            ),
            temperature=0.35,
            max_output_tokens=1_000,
            response_mime_type="application/json",
            response_schema=GeminiTextChatResult,
        )

        started_at = time.perf_counter()
        telemetry: dict[str, Any] = {"models": [], "calls": 0, "errors": []}
        try:
            contents: Any = prompt
            if request.image is not None:
                contents = [
                    prompt,
                    types.Part.from_bytes(
                        data=request.image.decoded_bytes(),
                        mime_type=request.image.mime_type,
                    ),
                ]
            inference_started = time.perf_counter()
            generation = self._generate_with_fallback(
                client,
                contents,
                config,
                telemetry=telemetry,
                fallback_on_timeout=True,
                task=task,
            )
            request_timeout = (
                self._settings.gemini_image_timeout_seconds
                if use_image_controls
                else self._settings.gemini_video_timeout_seconds
                if use_video_controls
                else self._settings.gemini_timeout_seconds
            )
            response = await asyncio.wait_for(generation, timeout=request_timeout)
            telemetry["inference_duration_ms"] = round((time.perf_counter() - inference_started) * 1000)
            result = (
                self._parse_video_followup_response(response)
                if has_video_context and not is_image_request
                else self._parse_response(response)
            )
            if has_video_context and any(term in request.message.casefold() for term in ("cooking instruction", "cooking step", "show me the cooking", "show the cooking")):
                result = result.model_copy(update={"recommendations": []})
            if is_image_request:
                result = _refine_image_result(result, request)
            usage = getattr(response, "usage_metadata", None)
            token_usage = getattr(usage, "total_token_count", None) if usage else None
            logger.info(
                "Gemini chat completed source=%s inference_ms=%s models=%s calls=%d latency_ms=%d token_usage=%s",
                "image" if use_image_controls else ("video_context" if use_video_controls else "text"),
                telemetry.get("inference_duration_ms", "n/a"),
                telemetry["models"],
                telemetry["calls"],
                (time.perf_counter() - started_at) * 1000,
                token_usage if token_usage is not None else "unavailable",
            )
            return ChatResponse.model_validate(result.model_dump(exclude_none=True))
        except AIResponseInvalidError:
            raise
        except AIProviderUnavailableError as exc:
            logger.warning(
                "Gemini chat unavailable source=%s task=%s models=%s calls=%d error_type=%s cause_type=%s",
                "image" if use_image_controls else ("video_context" if use_video_controls else "text"),
                task,
                telemetry["models"],
                telemetry["calls"],
                type(exc).__name__,
                type(exc.__cause__).__name__ if exc.__cause__ else "none",
            )
            raise
        except asyncio.TimeoutError as exc:
            logger.warning(
                "Gemini chat timed out source=%s models=%s calls=%d latency_ms=%d",
                "image" if use_image_controls else ("video_context" if use_video_controls else "text"),
                telemetry["models"],
                telemetry["calls"],
                (time.perf_counter() - started_at) * 1000,
            )
            raise AIProviderUnavailableError(
                "NutriBot đang xử lý quá lâu, vui lòng thử lại sau"
            ) from exc
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
        telemetry: dict[str, Any] | None = None,
        fallback_on_timeout: bool = False,
        video_request: bool = False,
        task: str | None = None,
        deadline: float | None = None,
    ) -> Any:
        telemetry = telemetry if telemetry is not None else {}
        telemetry.setdefault("models", [])
        telemetry.setdefault("calls", 0)
        telemetry.setdefault("errors", [])
        routing_task = task or "legacy"
        candidates = self._model_router.candidates(routing_task)
        if not candidates:
            logger.warning(
                "Gemini model routing rejected task=%s reason=no_eligible_model",
                routing_task,
            )
            raise self._model_router.unavailable_error(routing_task)
        logger.info(
            "Gemini model routing task=%s candidates=%s selected=%s",
            routing_task, candidates, candidates[0],
        )

        for index, model in enumerate(candidates):
            telemetry["models"].append(model)
            telemetry["calls"] += 1
            try:
                if deadline is not None:
                    remaining = deadline - asyncio.get_running_loop().time()
                    if remaining <= 0:
                        raise asyncio.TimeoutError
                    response = await asyncio.wait_for(
                        client.aio.models.generate_content(
                            model=model, contents=prompt, config=config
                        ),
                        timeout=remaining,
                    )
                else:
                    response = await client.aio.models.generate_content(
                        model=model, contents=prompt, config=config
                    )
                self._model_router.mark_success(model)
                return response
            except errors.APIError as exc:
                telemetry["errors"].append({"model": model, "status": exc.code})
                logger.warning(
                    "Gemini provider error task=%s model=%s status=%s error=%s",
                    routing_task, model, exc.code, GeminiService._safe_provider_error(exc),
                )
                if exc.code == 429:
                    retry_after = self._retry_after_seconds(exc)
                    self._model_router.mark_failure(
                        model, 429, "quota_exceeded", retry_after
                    )
                    logger.warning(
                        "Gemini model cooldown model=%s reason=quota retry_after_seconds=%s fallback=not_attempted",
                        model, retry_after if retry_after is not None else "unavailable",
                    )
                    raise AIQuotaExceededError(retry_after) from exc
                self._model_router.mark_failure(model, exc.code, type(exc).__name__)
                if exc.code in {500, 502, 503, 504} and index == 0 and len(candidates) > 1:
                    logger.info(
                        "Gemini fallback selected task=%s primary=%s fallback=%s status=%s",
                        routing_task, model, candidates[1], exc.code
                    )
                    continue
                raise
            except httpx.TimeoutException:
                self._model_router.mark_failure(model, None, "timeout")
                if fallback_on_timeout and index == 0 and len(candidates) > 1:
                    logger.info(
                        "Gemini fallback selected primary=%s fallback=%s reason=http_timeout",
                        model, candidates[1]
                    )
                    continue
                raise
            except Exception as exc:
                telemetry["errors"].append({"model": model, "type": type(exc).__name__})
                raise
        raise self._model_router.unavailable_error(routing_task)

    async def _legacy_generate_with_fallback(
        self,
        client: Any,
        prompt: Any,
        config: types.GenerateContentConfig,
        telemetry: dict[str, Any] | None = None,
        fallback_on_timeout: bool = False,
        video_request: bool = False,
    ) -> Any:
        telemetry = telemetry if telemetry is not None else {}
        telemetry.setdefault("models", [])
        telemetry.setdefault("calls", 0)
        telemetry.setdefault("errors", [])

        async def generate(model: str) -> Any:
            telemetry["models"].append(model)
            telemetry["calls"] += 1
            try:
                return await client.aio.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config,
                )
            except errors.APIError as exc:
                telemetry["errors"].append({"model": model, "status": exc.code})
                logger.warning(
                    "Gemini model failed model=%s status=%s call=%d",
                    model,
                    exc.code,
                    telemetry["calls"],
                )
                if exc.code == 429:
                    retry_after = self._retry_after_seconds(exc)
                    logger.warning(
                        "Gemini quota/rate limit model=%s retry_after_seconds=%s",
                        model,
                        retry_after if retry_after is not None else "unavailable",
                    )
                    raise AIQuotaExceededError(retry_after) from exc
                raise
            except Exception as exc:
                telemetry["errors"].append(
                    {"model": model, "type": type(exc).__name__}
                )
                raise

        try:
            return await generate(self._settings.gemini_model)
        except errors.APIError as exc:
            fallback_model = self._settings.gemini_fallback_model
            # A 429 is an exhausted quota: retrying only adds latency.
            transient_statuses = {500, 502, 503, 504}
            if (
                exc.code not in transient_statuses
                or not fallback_model
                or fallback_model == self._settings.gemini_model
                or (video_request and fallback_model not in _VIDEO_CAPABLE_MODELS)
            ):
                raise
            logger.warning(
                "Model %s tạm thời không sẵn sàng (%s); chuyển sang %s",
                self._settings.gemini_model,
                exc.code,
                fallback_model,
            )
            logger.info(
                "Gemini fallback selected primary=%s fallback=%s status=%s",
                self._settings.gemini_model,
                fallback_model,
                exc.code,
            )
            return await generate(fallback_model)

        except httpx.TimeoutException as exc:
            fallback_model = self._settings.gemini_fallback_model
            if (
                not fallback_on_timeout
                or not fallback_model
                or fallback_model == self._settings.gemini_model
                or (video_request and fallback_model not in _VIDEO_CAPABLE_MODELS)
            ):
                raise
            logger.info(
                "Gemini fallback selected primary=%s fallback=%s reason=http_timeout",
                self._settings.gemini_model,
                fallback_model,
            )
            return await generate(fallback_model)

    @staticmethod
    def _retry_after_seconds(exc: errors.APIError) -> int | None:
        """Read only an explicit Google RPC RetryInfo delay."""
        details = getattr(exc, "details", None)
        if not isinstance(details, dict):
            return None

        error = details.get("error")
        candidates: list[Any] = []
        if isinstance(error, dict):
            candidates.append(error.get("details"))
        candidates.append(details.get("details"))

        for value in candidates:
            if not isinstance(value, list):
                continue
            for item in value:
                if not isinstance(item, dict):
                    continue
                type_name = str(item.get("@type", ""))
                if not type_name.endswith("google.rpc.RetryInfo"):
                    continue
                delay = item.get("retryDelay")
                if isinstance(delay, str):
                    match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)s\s*", delay)
                    if match:
                        return max(0, math.ceil(float(match.group(1))))
                elif isinstance(delay, dict):
                    seconds = delay.get("seconds")
                    nanos = delay.get("nanos", 0)
                    if isinstance(seconds, (int, float)) and isinstance(
                        nanos, (int, float)
                    ):
                        return max(0, math.ceil(float(seconds) + float(nanos) / 1e9))
        return None

    @staticmethod
    def _response_telemetry(response: Any) -> tuple[str, int | None]:
        usage = getattr(response, "usage_metadata", None)
        token_usage = getattr(usage, "total_token_count", None) if usage else None
        if usage and token_usage is None:
            token_usage = getattr(usage, "output_token_count", None)
        candidates = getattr(response, "candidates", None) or []
        finish = getattr(candidates[0], "finish_reason", None) if candidates else None
        finish_name = getattr(finish, "name", None) or str(finish or "unavailable")
        return finish_name, token_usage

    @staticmethod
    def _parse_video_extraction(response: Any) -> GeminiVideoExtraction:
        parsed = getattr(response, "parsed", None)
        try:
            if isinstance(parsed, GeminiVideoExtraction):
                return parsed
            if isinstance(parsed, GeminiChatResult):
                analysis = parsed.video_analysis
                if analysis is None:
                    raise ValueError("video_analysis missing")
                return GeminiVideoExtraction(
                    dish_name=analysis.dish_name,
                    ingredients=[item.name for item in analysis.ingredients],
                    steps=[item.instruction for item in analysis.steps],
                    uncertainties=analysis.uncertainties,
                )
            if parsed is not None:
                return GeminiVideoExtraction.model_validate(parsed)
            text = getattr(response, "text", None)
            if not text:
                raise ValueError("empty model response")
            payload_text = text.strip()
            try:
                payload = json.loads(payload_text)
            except json.JSONDecodeError:
                fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", payload_text, re.DOTALL)
                if fenced:
                    payload = json.loads(fenced.group(1))
                else:
                    start, end = payload_text.find("{"), payload_text.rfind("}")
                    if start < 0 or end <= start:
                        raise ValueError("response is not a JSON object")
                    payload = json.loads(payload_text[start : end + 1])
            return GeminiVideoExtraction.model_validate(payload)
        except ValidationError as exc:
            safe_errors = [
                {"loc": error.get("loc"), "type": error.get("type")}
                for error in exc.errors()
            ]
            logger.warning("Gemini video validation failed errors=%s", safe_errors)
            raise AIResponseInvalidError(
                "NutriBot nhận được dữ liệu video không hợp lệ, vui lòng thử lại"
            ) from exc
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            logger.warning(
                "Gemini video response format failed error_type=%s", type(exc).__name__
            )
            raise AIResponseInvalidError(
                "NutriBot nhận được dữ liệu video không hợp lệ, vui lòng thử lại"
            ) from exc

    async def _youtube_source(self, url: str | None) -> VideoSource | None:
        if not url:
            return None
        source = VideoSource(url=url, metadata_status="unavailable")
        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                response = await client.get("https://www.youtube.com/oembed", params={"url": url, "format": "json"})
                response.raise_for_status()
                payload = response.json()
            return source.model_copy(update={
                "title": payload.get("title") if isinstance(payload.get("title"), str) else None,
                "channel_name": payload.get("author_name") if isinstance(payload.get("author_name"), str) else None,
                "thumbnail_url": payload.get("thumbnail_url") if isinstance(payload.get("thumbnail_url"), str) else None,
                "metadata_verified": bool(payload.get("title") and payload.get("author_name")),
                "metadata_status": "verified" if payload.get("title") and payload.get("author_name") else "partial",
            })
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            logger.info("YouTube metadata unavailable error_type=%s", type(exc).__name__)
            return source

    @staticmethod
    def _build_video_result(extraction: GeminiVideoExtraction, video_source: VideoSource | None = None) -> ChatResponse:
        dish_name = extraction.dish_name.strip() if extraction.dish_name else None
        ingredients = []
        seen_ingredients: set[str] = set()
        for value in extraction.ingredients:
            clean = value.strip()
            if clean and clean.casefold() not in seen_ingredients:
                ingredients.append(VideoIngredient(name=clean))
                seen_ingredients.add(clean.casefold())
        steps = [
            VideoStep(order=index, instruction=value.strip())
            for index, value in enumerate(extraction.steps, start=1)
            if value.strip()
        ]
        uncertainties = []
        seen_uncertainties: set[str] = set()
        for value in extraction.uncertainties:
            clean = value.strip()
            if clean and clean.casefold() not in seen_uncertainties:
                uncertainties.append(clean)
                seen_uncertainties.add(clean.casefold())

        analysis = VideoAnalysis(
            dish_name=dish_name,
            ingredients=ingredients,
            steps=steps,
            uncertainties=uncertainties,
        )
        attribution = ""
        if video_source and video_source.metadata_verified and video_source.title and video_source.channel_name:
            attribution = (
                f"I analyzed the video '{video_source.title}' from the YouTube channel "
                f"'{video_source.channel_name}'. "
            )
        if not dish_name and not ingredients and not steps:
            reply = attribution + "The video does not provide enough verified cooking information to identify a complete dish or process."
        else:
            reply = attribution + f"The identified dish is {dish_name or 'unavailable'}."
            if ingredients:
                reply += "\n\nIngredients:\n" + "\n".join(f"- {item.name}" for item in ingredients)
            if steps:
                reply += f"\n\nThe video contains {len(steps)} cooking steps."
        if uncertainties:
            reply += " Lưu ý: " + " ".join(uncertainties)

        context_parts = []
        if dish_name:
            context_parts.append("Món được nhận diện: " + dish_name + ".")
        if ingredients:
            context_parts.append("Nguyên liệu: " + ", ".join(item.name for item in ingredients) + ".")
        if steps:
            context_parts.append("Số bước đã xác minh: " + str(len(steps)) + ".")
        if uncertainties:
            context_parts.append("Chưa chắc chắn: " + " ".join(uncertainties))
        context = " ".join(context_parts) or "Chưa xác định được thông tin nấu ăn đáng tin cậy từ video."
        return ChatResponse(
            reply=reply,
            recommendations=[],
            video_analysis=analysis,
            video_context=context[:2_000],
            video_source=video_source,
            video_summary=context[:2_000],
            suggested_actions=([SuggestedAction(type="COOKING_INSTRUCTIONS", label="Show cooking instructions")] if ingredients else []),
        )
    @staticmethod
    def _parse_video_followup_response(response: Any) -> ChatResponse:
        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, GeminiTextChatResult):
            return ChatResponse.model_validate(parsed.model_dump(exclude_none=True))
        try:
            parsed = GeminiService._parse_response(response)
            return ChatResponse.model_validate(parsed.model_dump(exclude_none=True))
        except AIProviderUnavailableError:
            text = (getattr(response, "text", None) or "").strip()
            if text and not text.startswith(("{", "[", "```")):
                return ChatResponse(reply=text, recommendations=[])
            raise

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
            logger.warning(
                "Gemini response validation failed error_type=%s details=%s",
                type(exc).__name__,
                GeminiService._safe_validation_errors(exc),
            )
            raise AIResponseInvalidError(
                "NutriBot nhan duoc phan hoi thuc don khong hop le, vui long thu lai"
            ) from exc

    @staticmethod
    def _safe_provider_error(exc: Exception) -> str:
        message = str(exc).replace("\n", " ")
        message = re.sub(r"AIza[0-9A-Za-z_-]+", "<redacted>", message)
        return message[:240]

    @staticmethod
    def _safe_validation_errors(exc: Exception) -> list[dict[str, Any]]:
        if isinstance(exc, ValidationError):
            return [
                {"loc": item.get("loc"), "type": item.get("type")}
                for item in exc.errors()
            ][:5]
        return [{"type": type(exc).__name__}]

    @staticmethod
    def _parse_response(response: Any) -> GeminiChatResult:
        parsed = getattr(response, "parsed", None)
        logger.info("Gemini response parsed_type=%s", type(parsed).__name__)
        try:
            if isinstance(parsed, (GeminiChatResult, GeminiTextChatResult)):
                if isinstance(parsed, GeminiTextChatResult):
                    return GeminiChatResult.model_validate(
                        parsed.model_dump(exclude_none=True)
                    )
                return parsed
            text = None
            if parsed is not None and not isinstance(parsed, str):
                return GeminiChatResult.model_validate(parsed)
            if isinstance(parsed, str):
                text = parsed
            else:
                text = getattr(response, "text", None)
            if not text:
                raise ValueError("Gemini trả về nội dung rỗng")
            try:
                return GeminiChatResult.model_validate_json(text)
            except ValidationError:
                # Some Gemini model versions return a fenced JSON document even
                # when application/json was requested. Accept only a bounded
                # JSON object; free-form text still fails closed below.
                fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
                if fenced:
                    return GeminiChatResult.model_validate_json(fenced.group(1))
                start, end = text.find("{"), text.rfind("}")
                if start >= 0 and end > start:
                    return GeminiChatResult.model_validate_json(text[start : end + 1])
                raise
        except (ValidationError, ValueError) as exc:
            logger.warning(
                "Gemini chat response validation failed error_type=%s details=%s",
                type(exc).__name__,
                GeminiService._safe_validation_errors(exc),
            )
            raise AIResponseInvalidError(
                "NutriBot nhận được phản hồi không hợp lệ, vui lòng thử lại"
            ) from exc
