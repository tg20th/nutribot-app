"""FastAPI application cho NutriBot AI Service."""

from datetime import UTC, datetime
from typing import Any

from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import Settings
from app.exceptions import AIServiceError
from app.planner import MealPlanRequest, MealPlanResponse
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.gemini_service import GeminiService


def _timestamp() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _error_response(message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": message,
            "data": None,
            "timestamp": _timestamp(),
        },
    )


def _get_gemini_service(request: Request) -> GeminiService:
    return request.app.state.gemini_service


def create_app(
    settings: Settings | None = None,
    gemini_service: Any | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings.from_env()
    application = FastAPI(
        title=resolved_settings.app_name,
        description="AI tư vấn dinh dưỡng nội bộ cho hệ thống NutriBot",
        version=resolved_settings.app_version,
    )
    application.state.settings = resolved_settings
    application.state.gemini_service = gemini_service or GeminiService(
        resolved_settings
    )

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        first_error = exc.errors()[0] if exc.errors() else {}
        location = ".".join(str(part) for part in first_error.get("loc", [])[1:])
        detail = first_error.get("msg", "Dữ liệu không hợp lệ")
        message = f"{location}: {detail}" if location else detail
        return _error_response(message, 422)

    @application.exception_handler(AIServiceError)
    async def ai_exception_handler(
        _request: Request,
        exc: AIServiceError,
    ) -> JSONResponse:
        return _error_response(str(exc), status.HTTP_503_SERVICE_UNAVAILABLE)

    @application.get("/", tags=["System"])
    async def root() -> dict[str, Any]:
        return {
            "success": True,
            "message": "NutriBot AI Service đang hoạt động",
            "data": {
                "service": resolved_settings.app_name,
                "version": resolved_settings.app_version,
            },
            "timestamp": _timestamp(),
        }

    @application.get("/health", tags=["System"])
    async def health() -> dict[str, Any]:
        return {
            "success": True,
            "message": "AI service khỏe mạnh",
            "data": {
                "status": "healthy",
                "provider": "google-gemini",
                "configured": resolved_settings.gemini_configured,
            },
            "timestamp": _timestamp(),
        }

    @application.post(
        "/api/ai/chat",
        response_model=ChatResponse,
        tags=["Chatbot"],
        summary="Tư vấn dinh dưỡng bằng Gemini",
    )
    async def chat(
        chat_request: ChatRequest,
        service: GeminiService = Depends(_get_gemini_service),
    ) -> ChatResponse:
        return await service.chat(chat_request)

    @application.post(
        "/api/ai/generate-meal-plan",
        response_model=MealPlanResponse,
        tags=["Meal Planner"],
        summary="Generate a seven-day vegan meal-plan preview",
    )
    async def generate_meal_plan(
        meal_plan_request: MealPlanRequest,
        service: GeminiService = Depends(_get_gemini_service),
    ) -> MealPlanResponse:
        return await service.generate_meal_plan(meal_plan_request)

    return application


app = create_app()
