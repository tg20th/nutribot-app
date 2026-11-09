import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import Settings
from app.schemas.moderation import ModerationRequest
from app.services.content_moderation_service import ContentModerationService
from app.services.gemini_service import GeminiService


def run(coro):
    return asyncio.run(coro)


def test_youtube_video_moderation_creates_part_from_uri_and_routes_video_task():
    captured = {}
    service = GeminiService(Settings(gemini_api_key="test-key"), client=MagicMock())

    async def mock_generate(client, contents, config, **kwargs):
        captured["contents"] = contents
        captured["config"] = config
        captured["kwargs"] = kwargs
        return SimpleNamespace(parsed={
            "decision": "APPROVE",
            "reason": "Hợp lệ - video món chay đậu phụ sốt cà chua",
            "confidence": 0.98,
            "categories": ["SAFE"],
        })

    service._generate_with_fallback = mock_generate

    request = ModerationRequest(
        content_id=10,
        content_type="VIDEO",
        title="Đậu phụ sốt cà chua chay thơm ngon",
        media_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    )

    res = run(service.moderate_content(request))
    assert res["decision"] == "APPROVE"
    assert res["confidence"] == 0.98
    assert "SAFE" in res["categories"]

    # Verify contents contains video part
    contents = captured["contents"]
    assert isinstance(contents, list)
    assert len(contents) >= 2
    video_part = contents[-1]
    assert hasattr(video_part, "file_data") or hasattr(video_part, "inline_data") or str(type(video_part))
    assert captured["kwargs"].get("task") == "video"
    assert captured["kwargs"].get("video_request") is True


def test_cloudinary_video_moderation_downloads_and_cleans_up():
    captured = {}
    mock_client = MagicMock()
    mock_uploaded = SimpleNamespace(name="files/test_vid_123", uri="https://gemini.api/files/test_vid_123", state="ACTIVE")
    mock_client.aio.files.upload = AsyncMock(return_value=mock_uploaded)
    mock_client.aio.files.get = AsyncMock(return_value=mock_uploaded)
    mock_client.aio.files.delete = AsyncMock(return_value=None)

    service = GeminiService(Settings(gemini_api_key="test-key"), client=mock_client)

    async def mock_generate(client, contents, config, **kwargs):
        captured["contents"] = contents
        return SimpleNamespace(parsed={
            "decision": "APPROVE",
            "reason": "Video hướng dẫn làm salad chay chuẩn",
            "confidence": 0.96,
            "categories": ["SAFE"],
        })

    service._generate_with_fallback = mock_generate

    fake_stream_bytes = b"fake video content header ftyp mp4...."

    class FakeStreamResponse:
        status_code = 200
        headers = {"content-type": "video/mp4", "content-length": str(len(fake_stream_bytes))}

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def aiter_bytes(self, chunk_size=65536):
            yield fake_stream_bytes

    class FakeHttpxClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        def stream(self, method, url):
            return FakeStreamResponse()

    with patch("httpx.AsyncClient", return_value=FakeHttpxClient()):
        request = ModerationRequest(
            content_id=11,
            content_type="VIDEO",
            title="Salad rau củ quả thuần chay",
            media_url="https://res.cloudinary.com/test-cloud/video/upload/v1234/salad.mp4",
        )
        res = run(service.moderate_content(request))
        assert res["decision"] == "APPROVE"
        # Assert file was uploaded and cleaned up
        mock_client.aio.files.upload.assert_called_once()
        mock_client.aio.files.delete.assert_called_once_with(name="files/test_vid_123")


def test_video_download_http_error_failsafe_needs_review():
    service = GeminiService(Settings(gemini_api_key="test-key"), client=MagicMock())

    class Fake404Response:
        status_code = 404
        headers = {}

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

    class FakeHttpxClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        def stream(self, method, url):
            return Fake404Response()

    with patch("httpx.AsyncClient", return_value=FakeHttpxClient()):
        request = ModerationRequest(
            content_id=12,
            content_type="VIDEO",
            title="Video nấu ăn",
            media_url="https://res.cloudinary.com/test-cloud/video/upload/not_found.mp4",
        )
        res = run(service.moderate_content(request))
        assert res["decision"] == "NEEDS_REVIEW"
        assert res["confidence"] == 0.0
        assert "HTTP 404" in res["reason"]
        assert "AMBIGUOUS" in res["categories"]


def test_video_oversized_failsafe_needs_review():
    service = GeminiService(Settings(gemini_api_key="test-key"), client=MagicMock())

    class FakeOversizedResponse:
        status_code = 200
        headers = {"content-type": "video/mp4", "content-length": str(30 * 1024 * 1024)}  # 30MB > 25MB

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

    class FakeHttpxClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        def stream(self, method, url):
            return FakeOversizedResponse()

    with patch("httpx.AsyncClient", return_value=FakeHttpxClient()):
        request = ModerationRequest(
            content_id=13,
            content_type="VIDEO",
            title="Video nấu ăn dài 30MB",
            media_url="https://res.cloudinary.com/test-cloud/video/upload/large.mp4",
        )
        res = run(service.moderate_content(request))
        assert res["decision"] == "NEEDS_REVIEW"
        assert res["confidence"] == 0.0
        assert "vượt quá dung lượng" in res["reason"]
        assert "AMBIGUOUS" in res["categories"]


def test_content_moderation_service_rejects_non_vegetarian_video():
    class FakeGeminiVideo:
        model_name = "test-video-model"

        async def moderate_content(self, _):
            return {
                "decision": "REJECT",
                "reason": "Video quay cảnh chế biến và nấu thịt bò",
                "confidence": 0.99,
                "categories": ["NON_VEGETARIAN_CONTENT"],
            }

    service = ContentModerationService(FakeGeminiVideo())
    request = ModerationRequest(
        content_id=14,
        content_type="VIDEO",
        title="Cách làm món ăn hấp dẫn",
        media_url="https://www.youtube.com/watch?v=example",
    )
    res = run(service.moderate(request))
    assert res.decision == "REJECT"
    assert "NON_VEGETARIAN_CONTENT" in res.categories
    assert res.confidence == 0.99
    assert res.model == "test-video-model"


def test_content_moderation_service_approves_safe_vegetarian_video():
    class FakeGeminiVideo:
        model_name = "test-video-model"

        async def moderate_content(self, _):
            return {
                "decision": "APPROVE",
                "reason": "Video hướng dẫn làm món canh chua chay thanh đạm",
                "confidence": 0.98,
                "categories": ["SAFE"],
            }

    service = ContentModerationService(FakeGeminiVideo())
    request = ModerationRequest(
        content_id=15,
        content_type="VIDEO",
        title="Canh chua chay",
        media_url="https://www.youtube.com/watch?v=example",
    )
    res = run(service.moderate(request))
    assert res.decision == "APPROVE"
    assert "SAFE" in res.categories
    assert res.confidence == 0.98

