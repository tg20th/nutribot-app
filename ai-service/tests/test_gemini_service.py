import asyncio
from types import SimpleNamespace

from google.genai import errors

from app.config import Settings
from app.prompts import SYSTEM_INSTRUCTION, build_user_prompt
from app.schemas.chat import ChatRequest, GeminiChatResult
from app.services.gemini_service import GeminiService


class FakeModels:
    def __init__(self) -> None:
        self.call = None

    async def generate_content(self, **kwargs):
        self.call = kwargs
        return SimpleNamespace(
            parsed=GeminiChatResult(
                reply="Bữa sáng có thể kết hợp yến mạch và sữa đậu nành.",
                recommendations=["Yến mạch", "Sữa đậu nành"],
            )
        )


class TransientFailureModels(FakeModels):
    def __init__(self) -> None:
        super().__init__()
        self.models = []

    async def generate_content(self, **kwargs):
        self.models.append(kwargs["model"])
        if len(self.models) == 1:
            raise errors.ServerError(
                503,
                {"error": {"code": 503, "message": "High demand", "status": "UNAVAILABLE"}},
            )
        return await super().generate_content(**kwargs)


def test_gemini_service_uses_structured_output_and_configured_model():
    models = FakeModels()
    client = SimpleNamespace(aio=SimpleNamespace(models=models))
    service = GeminiService(
        Settings(gemini_api_key="test-key", gemini_model="test-model"),
        client=client,
    )
    request = ChatRequest(
        message="Gợi ý bữa sáng",
        session_id="session-1",
        user_context={"allergies": ["Hạt điều"]},
    )

    response = asyncio.run(service.chat(request))

    assert response.recommendations == ["Yến mạch", "Sữa đậu nành"]
    assert models.call["model"] == "test-model"
    assert "Hạt điều" in models.call["contents"]
    assert models.call["config"].response_mime_type == "application/json"


def test_prompt_limits_history_and_preserves_user_context():
    request = ChatRequest(
        message="Tôi nên ăn gì?",
        session_id="session-2",
        user_context={"bmi": 20.2, "allergies": ["Đậu phộng"]},
        conversation_history=[
            {"sender": "USER", "content": f"Tin nhắn {index}"}
            for index in range(5)
        ],
    )

    prompt = build_user_prompt(request, max_history_messages=2)

    assert "Đậu phộng" in prompt
    assert "Tin nhắn 4" in prompt
    assert "Tin nhắn 3" in prompt
    assert "Tin nhắn 2" not in prompt


def test_system_prompt_restricts_advice_to_vegan_food():
    normalized_instruction = SYSTEM_INSTRUCTION.casefold()

    assert "chỉ tư vấn" in normalized_instruction
    assert "thuần chay" in normalized_instruction
    assert "không tư vấn" in normalized_instruction
    assert "thịt" in normalized_instruction
    assert "cá" in normalized_instruction
    assert "trứng" in normalized_instruction
    assert "sữa động vật" in normalized_instruction
    assert "mật ong" in normalized_instruction
    assert "gelatin" in normalized_instruction
    assert "từ chối" in normalized_instruction


def test_gemini_service_falls_back_when_latest_model_is_overloaded():
    models = TransientFailureModels()
    client = SimpleNamespace(aio=SimpleNamespace(models=models))
    service = GeminiService(
        Settings(
            gemini_api_key="test-key",
            gemini_model="gemini-latest",
            gemini_fallback_model="gemini-stable",
        ),
        client=client,
    )

    response = asyncio.run(
        service.chat(ChatRequest(message="Gợi ý bữa sáng", session_id="session-1"))
    )

    assert response.reply
    assert models.models == ["gemini-latest", "gemini-stable"]
