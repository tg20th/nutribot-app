"""Tích hợp Google Gemini bằng SDK google-genai."""

import logging
from typing import Any

from google import genai
from google.genai import errors, types
from pydantic import ValidationError

from app.config import Settings
from app.exceptions import AIConfigurationError, AIProviderUnavailableError
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

        try:
            response = await self._generate_with_fallback(client, prompt, config)
            result = self._parse_response(response)
            return ChatResponse.model_validate(result.model_dump())
        except AIProviderUnavailableError:
            raise
        except Exception as exc:
            logger.exception("Gemini không thể xử lý yêu cầu: %s", type(exc).__name__)
            raise AIProviderUnavailableError(
                "NutriBot đang bận, vui lòng thử lại sau"
            ) from exc

    async def _generate_with_fallback(
        self,
        client: Any,
        prompt: str,
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
            transient_statuses = {429, 500, 502, 503, 504}
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
