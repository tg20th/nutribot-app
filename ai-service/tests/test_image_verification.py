"""Unit tests cho tính năng xác minh ảnh món ăn với caption (NB-64)."""
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas.image_verification import ImageRelevanceRequest, ImageRelevanceResponse
from app.services.gemini_service import GeminiService
from app.config import Settings


class FakeGeminiImageVerifier:
    def __init__(self, response: ImageRelevanceResponse | None = None, raise_error: bool = False):
        self.response = response
        self.raise_error = raise_error

    async def verify_image_relevance(self, request: ImageRelevanceRequest) -> ImageRelevanceResponse:
        if self.raise_error:
            raise RuntimeError("Gemini connection error")
        if self.response is not None:
            return self.response
        return ImageRelevanceResponse(
            is_relevant=True,
            confidence=0.95,
            detected_dish="Salad đậu phụ sốt mè",
            match_status="MATCH",
            reason="Ảnh phù hợp hoàn toàn với mô tả món salad đậu phụ trong caption.",
            is_food=True,
            is_vegetarian=True,
        )


@pytest.fixture
def client_with_fake_gemini():
    fake_gemini = FakeGeminiImageVerifier()
    app = create_app(gemini_service=fake_gemini)
    return TestClient(app)


def test_schema_valid_request():
    req = ImageRelevanceRequest(
        image_url="https://res.cloudinary.com/sample/image/upload/salad.jpg",
        caption="Hôm nay mình làm món salad bơ đậu phụ thanh đạm",
        title="Salad bơ đậu phụ",
        recipe_ingredients=["Bơ", "Đậu phụ", "Xà lách", "Sốt mè rang"],
    )
    assert req.image_url.startswith("https://")
    assert req.caption == "Hôm nay mình làm món salad bơ đậu phụ thanh đạm"
    assert len(req.recipe_ingredients) == 4


def test_endpoint_match_success(client_with_fake_gemini):
    payload = {
        "image_url": "https://res.cloudinary.com/sample/image/upload/salad.jpg",
        "caption": "Món salad thanh đạm bổ dưỡng",
        "title": "Salad mùa hè",
        "recipe_ingredients": ["Xà lách", "Cà chua"],
    }
    response = client_with_fake_gemini.post("/api/ai/verify-image-relevance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_relevant"] is True
    assert data["match_status"] == "MATCH"
    assert data["is_food"] is True
    assert data["is_vegetarian"] is True
    assert data["confidence"] >= 0.9
    assert "Salad" in data["detected_dish"]


def test_endpoint_mismatch():
    fake_mismatch = FakeGeminiImageVerifier(
        response=ImageRelevanceResponse(
            is_relevant=False,
            confidence=0.99,
            detected_dish="Chiếc ô tô màu đỏ",
            match_status="MISMATCH",
            reason="Ảnh chụp phương tiện giao thông (ô tô), không phải đồ ăn.",
            is_food=False,
            is_vegetarian=None,
        )
    )
    app = create_app(gemini_service=fake_mismatch)
    client = TestClient(app)

    payload = {
        "image_url": "https://example.com/car.jpg",
        "caption": "Công thức nấu súp nấm chay thơm lừng",
        "title": "Súp nấm chay",
    }
    response = client.post("/api/ai/verify-image-relevance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_relevant"] is False
    assert data["match_status"] == "MISMATCH"
    assert data["is_food"] is False
    assert "ô tô" in data["reason"].lower()


def test_gemini_service_download_failure_graceful():
    import asyncio
    settings = Settings(
        gemini_api_key="test-api-key",
        gemini_model="gemini-2.5-flash",
    )
    service = GeminiService(settings=settings)

    # Mock httpx returning 404
    class MockResponse:
        status_code = 404
        content = b""
        headers = {}

    class MockAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def get(self, url):
            return MockResponse()

    with patch("httpx.AsyncClient", return_value=MockAsyncClient()):
        req = ImageRelevanceRequest(
            image_url="https://example.com/not-found.jpg",
            caption="Món canh chua chay thanh nhiệt",
        )
        result = asyncio.run(service.verify_image_relevance(req))
        assert result.is_relevant is False
        assert result.match_status == "UNRECOGNIZED"
        assert result.is_food is False
        assert "404" in result.reason
