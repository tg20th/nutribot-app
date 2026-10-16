import json

from fastapi.testclient import TestClient

from app.config import Settings
from app.exceptions import AIProviderUnavailableError, AIQuotaExceededError, AIResponseInvalidError
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
        weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        return MealPlanResponse(
            suggested_menu_title="Thực đơn chay 7 ngày",
            estimated_daily_calories=1750,
            weekly_plan=[
                {"day": weekdays[index], "breakfast": {"dishId": 1, "servings": 1}, "lunch": {"dishId": 2, "servings": 1}, "dinner": {"dishId": 3, "servings": 1}}
                for index in range(7)
            ],
        )


class InvalidResponseGeminiService:
    async def chat(self, _request):
        raise AIResponseInvalidError("AI response did not match the expected schema")


class QuotaGeminiService:
    async def chat(self, _request):
        raise AIQuotaExceededError(55898)


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


def test_quota_failure_returns_429_with_structured_retry_delay():
    app = create_app(
        settings=Settings(gemini_api_key="test-key"),
        gemini_service=QuotaGeminiService(),
    )
    response = TestClient(app).post(
        "/api/ai/chat",
        json={"message": "Goi y mon an", "session_id": "session-1"},
    )
    assert response.status_code == 429
    assert response.json()["error"] == "AI_QUOTA_EXCEEDED"
    assert response.json()["retry_after_seconds"] == 55898
    assert response.json()["data"] is None


def test_invalid_provider_response_returns_bad_gateway_not_service_unavailable():
    app = create_app(
        settings=Settings(gemini_api_key="test-key"),
        gemini_service=InvalidResponseGeminiService(),
    )

    response = TestClient(app).post(
        "/api/ai/chat",
        json={"message": "What should I eat?", "session_id": "session-1"},
    )

    assert response.status_code == 502
    assert response.json()["error"] == "AI_RESPONSE_INVALID"


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


def test_chat_accepts_plain_json_looking_history_text_without_parsing_it():
    service = StubGeminiService()
    client = TestClient(create_app(settings=Settings(gemini_api_key="test-key"), gemini_service=service))
    text = "{calories: 500, note: this is ordinary text}"

    response = client.post(
        "/api/ai/chat",
        json={
            "message": "Please continue",
            "session_id": "session-1",
            "conversation_history": [{"sender": "ASSISTANT", "content": text}],
        },
    )

    assert response.status_code == 200
    assert service.request.conversation_history[0].content == text


def test_chat_normalizes_legacy_media_json_string_and_repeated_requests():
    service = StubGeminiService()
    client = TestClient(create_app(settings=Settings(gemini_api_key="test-key"), gemini_service=service))
    legacy = json.dumps({
        "reply": "The photo contains tofu.",
        "image_context": "A tofu bowl with vegetables.",
        "recognized_ingredients": ["tofu", "carrot"],
    })
    payload = {
        "message": "What can I add next?",
        "session_id": "session-1",
        "conversation_history": [{"sender": "ASSISTANT", "content": legacy}],
    }

    for _ in range(3):
        response = client.post("/api/ai/chat", json=payload)
        assert response.status_code == 200
        content = service.request.conversation_history[0].content
        assert "image_context: A tofu bowl with vegetables." in content
        assert "recognized_ingredients: tofu, carrot" in content


def test_chat_accepts_legacy_attachment_only_history_json():
    service = StubGeminiService()
    client = TestClient(create_app(settings=Settings(gemini_api_key="test-key"), gemini_service=service))

    response = client.post(
        "/api/ai/chat",
        json={
            "message": "What did I attach?",
            "session_id": "session-1",
            "conversation_history": [{
                "sender": "USER",
                "content": json.dumps({"attachments": [{"type": "VIDEO", "filename": "meal.mp4"}]}),
            }],
        },
    )

    assert response.status_code == 200
    assert service.request.conversation_history[0].content == "media_attachment: VIDEO"


def test_generate_meal_plan_matches_internal_contract():
    app = create_app(
        settings=Settings(gemini_api_key="test-key"),
        gemini_service=StubGeminiService(),
    )
    canonical_dishes = [
        {
            "dishId": dish_id,
            "name": f"Canonical vegan dish {dish_id}",
            "servingSize": 1,
            "servingUnit": "portion",
            "calories": 600,
            "proteinG": 30,
            "carbsG": 75,
            "healthyFatsG": 20,
            "vegetarianType": "VEGAN",
            "isActive": True,
            "ingredients": [
                {"ingredientId": dish_id, "name": f"Ingredient {dish_id}"}
            ],
        }
        for dish_id in range(1, 15)
    ]
    response = TestClient(app).post(
        "/api/ai/generate-meal-plan",
        json={
            "vegetarianType": "VEGAN",
            "allergyIngredientIds": [],
            "nutritionTarget": {
                "calories": 1800,
                "proteinG": 90,
                "carbsG": 225,
                "fatG": 60,
                "estimated": False,
            },
            "canonicalDishes": canonical_dishes,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"OPTIMAL", "FEASIBLE"}
    assert [day["day"] for day in payload["days"]] == [
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
    ]
    assert all(len(day["meals"]) == 3 for day in payload["days"])
