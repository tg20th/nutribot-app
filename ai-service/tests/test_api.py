from fastapi.testclient import TestClient

from app.config import Settings
from app.exceptions import AIProviderUnavailableError
from app.main import create_app
from app.planner import MealPlanResponse
from app.schemas.chat import ChatResponse


class StubGeminiService:
    def __init__(self) -> None:
        self.request = None

    async def chat(self, request):
        self.request = request
        return ChatResponse(
            reply="Bạn có thể dùng sốt mè rang và kiểm tra nguy cơ nhiễm chéo.",
            recommendations=["Sốt mè rang", "Sốt hạt hướng dương"],
        )


class StubMealPlannerService(StubGeminiService):
    async def generate_meal_plan(self, request):
        self.meal_plan_request = request
        return MealPlanResponse(
            suggested_menu_title="Thực đơn chay 7 ngày",
            estimated_daily_calories=1750,
            weekly_plan=[
                {"day": f"Thứ {index}", "breakfast": "Yến mạch rau quả", "lunch": "Đậu hũ nấm", "dinner": "Canh rau củ"}
                for index in range(2, 9)
            ],
        )


class UnavailableGeminiService:
    async def chat(self, _request):
        raise AIProviderUnavailableError("NutriBot đang bận, vui lòng thử lại sau")


def test_health_does_not_require_api_key():
    app = create_app(settings=Settings(gemini_api_key=None))

    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json()["data"] == {
        "status": "healthy",
        "provider": "google-gemini",
        "configured": False,
    }


def test_chat_matches_internal_api_contract():
    service = StubGeminiService()
    app = create_app(
        settings=Settings(gemini_api_key="test-key"),
        gemini_service=service,
    )

    response = TestClient(app).post(
        "/api/ai/chat",
        json={
            "message": "Tôi dị ứng đậu phộng, nên thay bằng gì?",
            "session_id": "session-1234",
            "user_context": {"bmi": 20.2, "allergies": ["Đậu phộng"]},
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "reply": "Bạn có thể dùng sốt mè rang và kiểm tra nguy cơ nhiễm chéo.",
        "recommendations": ["Sốt mè rang", "Sốt hạt hướng dương"],
    }
    assert service.request.session_id == "session-1234"
    assert service.request.user_context.allergies == ["Đậu phộng"]


def test_chat_normalizes_integer_session_and_duplicate_allergies():
    service = StubGeminiService()
    app = create_app(
        settings=Settings(gemini_api_key="test-key"),
        gemini_service=service,
    )

    response = TestClient(app).post(
        "/api/ai/chat",
        json={
            "message": "  Gợi ý bữa sáng  ",
            "session_id": 12,
            "user_context": {
                "allergies": [" Đậu phộng ", "đậu phộng", ""],
            },
        },
    )

    assert response.status_code == 200
    assert service.request.session_id == "12"
    assert service.request.message == "Gợi ý bữa sáng"
    assert service.request.user_context.allergies == ["Đậu phộng"]


def test_blank_message_returns_standard_error_envelope():
    app = create_app(
        settings=Settings(gemini_api_key="test-key"),
        gemini_service=StubGeminiService(),
    )

    response = TestClient(app).post(
        "/api/ai/chat",
        json={"message": "   ", "session_id": "session-1"},
    )

    assert response.status_code == 422
    payload = response.json()
    assert payload["success"] is False
    assert payload["data"] is None
    assert "message" in payload
    assert payload["timestamp"].endswith("Z")


def test_provider_failure_returns_service_unavailable():
    app = create_app(
        settings=Settings(gemini_api_key="test-key"),
        gemini_service=UnavailableGeminiService(),
    )

    response = TestClient(app).post(
        "/api/ai/chat",
        json={"message": "Gợi ý bữa tối", "session_id": "session-1"},
    )

    assert response.status_code == 503
    assert response.json()["message"] == "NutriBot đang bận, vui lòng thử lại sau"


def test_missing_api_key_returns_service_unavailable_without_breaking_health():
    app = create_app(settings=Settings(gemini_api_key=None))
    client = TestClient(app)

    response = client.post(
        "/api/ai/chat",
        json={"message": "Gợi ý bữa tối", "session_id": "session-1"},
    )

    assert response.status_code == 503
    assert response.json()["message"] == (
        "AI service chưa được cấu hình GEMINI_API_KEY"
    )
    assert client.get("/health").status_code == 200


def test_generate_meal_plan_matches_internal_contract():
    service = StubMealPlannerService()
    app = create_app(settings=Settings(gemini_api_key="test-key"), gemini_service=service)
    response = TestClient(app).post(
        "/api/ai/generate-meal-plan",
        json={
            "target_calories": 1800,
            "health_goal": "maintain_weight",
            "available_ingredients": ["Đậu hũ", "Nấm"],
            "excluded_allergies": ["Đậu phộng"],
            "bmi": 20.2,
        },
    )

    assert response.status_code == 200
    assert response.json()["estimatedDailyCalories"] == 1750
    assert len(response.json()["weeklyPlan"]) == 7
    assert service.meal_plan_request.excluded_allergies == ["Đậu phộng"]
