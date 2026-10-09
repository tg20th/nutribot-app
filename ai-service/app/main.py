"""FastAPI application cho NutriBot AI Service."""

from datetime import UTC, datetime
import logging
from typing import Any

from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import Settings
from app.exceptions import AIServiceError
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.gemini_service import GeminiService
from app.services.recommender import ContentRecommender
from app.schemas.recommender import RecommendationRequest, RecommendationResponse
from app.schemas.moderation import ModerationRequest, ModerationResponse
from app.services.content_moderation_service import ContentModerationService
from app.schemas.deterministic_planner import DeterministicPlannerRequest
from app.services.meal_planner_service import MealPlannerService
from app.schemas.nutrition import NutritionCalculationRequest, NutritionCalculationResponse
from app.services.nutrition_service import NutritionCalculationService
from app.schemas.image_verification import ImageRelevanceRequest, ImageRelevanceResponse

logger = logging.getLogger(__name__)


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
    application.state.recommender = ContentRecommender()

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        first_error = exc.errors()[0] if exc.errors() else {}
        location = ".".join(str(part) for part in first_error.get("loc", [])[1:])
        detail = first_error.get("msg", "Dữ liệu không hợp lệ")
        body_keys = sorted(exc.body.keys()) if isinstance(exc.body, dict) else None
        logger.warning(
            "Chat request validation failed at '%s'; body type=%s, body keys=%s",
            location or "body",
            type(exc.body).__name__,
            body_keys,
        )
        message = f"{location or 'body'}: {detail}"
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

    @application.post("/api/ai/generate-meal-plan", tags=["Meal Planner"])
    async def generate_deterministic_meal_plan(
        request: DeterministicPlannerRequest,
    ) -> dict[str, Any]:
        """Canonical deterministic V1 endpoint; intentionally no Gemini dependency."""
        return MealPlannerService().generate_weekly_plan(request)

    @application.post("/api/ai/content-recommendations", response_model=RecommendationResponse, tags=["Recommendations"])
    async def content_recommendations(recommendation_request: RecommendationRequest) -> RecommendationResponse:
        return application.state.recommender.recommend(recommendation_request)
    @application.post("/api/ai/moderate-content",response_model=ModerationResponse,tags=["Moderation"])
    async def moderate_content(request: ModerationRequest) -> ModerationResponse:
        return await ContentModerationService(application.state.gemini_service).moderate(request)

    @application.post("/api/ai/calculate-nutrition", response_model=NutritionCalculationResponse, tags=["Nutrition"])
    async def calculate_nutrition(request: NutritionCalculationRequest) -> NutritionCalculationResponse:
        return await NutritionCalculationService(application.state.gemini_service).calculate(request)

    @application.post(
        "/api/ai/verify-image-relevance",
        response_model=ImageRelevanceResponse,
        tags=["Moderation"],
        summary="Xác minh tính liên quan giữa ảnh và món ăn / caption",
    )
    async def verify_image_relevance(
        request: ImageRelevanceRequest,
        service: GeminiService = Depends(_get_gemini_service),
    ) -> ImageRelevanceResponse:
        return await service.verify_image_relevance(request)

    return application


app = create_app()
