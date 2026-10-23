import asyncio
import base64
from types import SimpleNamespace

import pytest
from google.genai import errors
from pydantic import ValidationError

from app.config import Settings
from app.exceptions import AIProviderUnavailableError, AIResponseInvalidError
from app.schemas.chat import ChatRequest, GeminiChatResult, GeminiVideoExtraction, VideoSource
from app.services.gemini_service import GeminiService


MP4 = b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2"
MP4_B64 = base64.b64encode(MP4).decode()


def video_request(**overrides):
    payload = {
        "message": "analyze this cooking video",
        "session_id": "video-session",
        "video": {"data_base64": MP4_B64, "mime_type": "video/mp4"},
    }
    payload.update(overrides)
    return ChatRequest.model_validate(payload)


class FakeFiles:
    def __init__(self, states=None):
        self.states = list(states or ["ACTIVE"])
        self.upload_calls = []
        self.get_calls = []
        self.delete_calls = []

    async def upload(self, **kwargs):
        self.upload_calls.append(kwargs)
        return SimpleNamespace(
            name="files/test-video",
            uri="https://generativelanguage.googleapis.com/v1beta/files/test-video",
            mime_type="video/mp4",
            state=SimpleNamespace(name=self.states[0]),
        )

    async def get(self, **kwargs):
        self.get_calls.append(kwargs)
        state = self.states.pop(1) if len(self.states) > 1 else "ACTIVE"
        return SimpleNamespace(
            name="files/test-video",
            uri="https://generativelanguage.googleapis.com/v1beta/files/test-video",
            mime_type="video/mp4",
            state=SimpleNamespace(name=state),
        )

    async def delete(self, **kwargs):
        self.delete_calls.append(kwargs)


class FakeModels:
    def __init__(self, result=None, error=None, delay=0):
        self.result = result or GeminiChatResult(
            reply="unused legacy result",
            recommendations=[],
            video_analysis={"dish_name": "Tofu dish", "ingredients": [{"name": "tofu"}], "steps": [{"order": 1, "instruction": "cook tofu"}], "uncertainties": []},
            video_context="Tofu dish; one cooking step.",
        )
        self.error = error
        self.delay = delay
        self.calls = []

    async def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.error:
            error = self.error
            self.error = None
            raise error
        if hasattr(self.result, "parsed"):
            return self.result
        return SimpleNamespace(parsed=self.result, usage_metadata=None)


def service_for(models, files=None, **settings):
    client = SimpleNamespace(aio=SimpleNamespace(models=models, files=files or FakeFiles()))
    return GeminiService(Settings(gemini_api_key="test-key", **settings), client=client)


@pytest.mark.parametrize(
    "url",
    [
        "https://www.youtube.com/watch?v=9hE5-98ZeCg",
        "https://youtu.be/9hE5-98ZeCg",
        "https://www.youtube.com/shorts/9hE5-98ZeCg",
    ],
)
def test_accepts_allowlisted_youtube_urls(url):
    assert ChatRequest(message="analyze", session_id="s", video_url=url).video_url == url


@pytest.mark.parametrize(
    "url",
    [
        "http://www.youtube.com/watch?v=9hE5-98ZeCg",
        "https://evil.example/youtube.com/watch?v=9hE5-98ZeCg",
        "https://www.youtube.com/playlist?list=PL1234567890",
        "https://www.youtube.com/watch?v=short",
        "https://www.youtube.com/watch?v=9hE5-98ZeCg&v=another",
        "https://www.youtube.com/watch?v=9hE5-98ZeCg#instructions",
    ],
)
def test_rejects_invalid_or_malicious_youtube_urls(url):
    with pytest.raises(ValidationError):
        ChatRequest(message="x", session_id="s", video_url=url)


def test_rejects_corrupt_unsupported_and_mutually_exclusive_video_inputs():
    with pytest.raises(ValidationError):
        ChatRequest(message="x", session_id="s", video={"data_base64": base64.b64encode(b"bad").decode(), "mime_type": "video/mp4"})
    with pytest.raises(ValidationError):
        ChatRequest(message="x", session_id="s", video={"data_base64": MP4_B64, "mime_type": "application/octet-stream"})
    with pytest.raises(ValidationError):
        ChatRequest(message="x", session_id="s", video_url="https://youtu.be/9hE5-98ZeCg", video=video_request().video)


def test_uploaded_video_lifecycle_and_cleanup():
    files = FakeFiles(states=["PROCESSING", "ACTIVE"])
    models = FakeModels()
    result = asyncio.run(service_for(models, files=files).chat(video_request()))
    assert result.video_analysis.dish_name == "Tofu dish"
    assert result.video_analysis.steps[0].order == 1
    assert len(files.upload_calls) == 1
    assert len(files.get_calls) == 1
    assert files.delete_calls == [{"name": "files/test-video"}]
    assert models.calls[0]["contents"][0].file_data.file_uri.endswith("test-video")


def test_upload_failure_cleans_remote_file():
    files = FakeFiles(states=["FAILED"])
    with pytest.raises(AIProviderUnavailableError):
        asyncio.run(service_for(FakeModels(), files=files).chat(video_request()))
    assert files.delete_calls == [{"name": "files/test-video"}]


def test_503_uses_one_video_capable_fallback():
    models = FakeModels(error=errors.APIError(503, {"error": {"message": "unavailable"}}))
    result = asyncio.run(
        service_for(models, gemini_fallback_model="gemini-3.5-flash-lite").chat(video_request())
    )
    assert result.video_analysis.ingredients
    assert len(models.calls) == 2


def test_video_two_503_responses_stop_after_one_fallback():
    class UnavailableModels(FakeModels):
        async def generate_content(self, **kwargs):
            self.calls.append(kwargs)
            raise errors.APIError(503, {"error": {"message": "unavailable"}})

    models = UnavailableModels()
    with pytest.raises(AIProviderUnavailableError):
        asyncio.run(
            service_for(models, gemini_fallback_model="gemini-3.5-flash-lite").chat(video_request())
        )

    assert len(models.calls) == 2


def test_video_primary_503_fallback_504_stops_after_two_calls():
    class HighDemandThenDeadline:
        def __init__(self):
            self.calls = []

        async def generate_content(self, **kwargs):
            self.calls.append(kwargs["model"])
            status = 503 if len(self.calls) == 1 else 504
            raise errors.APIError(status, {"error": {"message": "provider failure"}})

    models = HighDemandThenDeadline()
    with pytest.raises(AIProviderUnavailableError):
        asyncio.run(service_for(models).chat(
            ChatRequest(message="analyze", session_id="s", video_url="https://youtu.be/9hE5-98ZeCg")
        ))

    assert models.calls == ["gemini-3.5-flash-lite", "gemini-3.6-flash"]


def test_video_application_deadline_does_not_start_fallback():
    class SlowProvider:
        def __init__(self):
            self.calls = []

        async def generate_content(self, **kwargs):
            self.calls.append(kwargs["model"])
            await asyncio.sleep(1)

    models = SlowProvider()
    with pytest.raises(AIProviderUnavailableError):
        asyncio.run(service_for(models, gemini_video_timeout_seconds=0.02).chat(
            ChatRequest(message="analyze", session_id="s", video_url="https://youtu.be/9hE5-98ZeCg")
        ))

    assert models.calls == ["gemini-3.5-flash-lite"]


def test_429_is_not_retried_or_fallback():
    models = FakeModels(error=errors.APIError(429, {"error": {"message": "quota"}}))
    with pytest.raises(AIProviderUnavailableError):
        asyncio.run(service_for(models, gemini_fallback_model="gemini-3.5-flash-lite").chat(video_request()))
    assert len(models.calls) == 1


def test_total_video_timeout_is_bounded():
    models = FakeModels(delay=1)
    with pytest.raises(AIProviderUnavailableError, match="quá lâu"):
        asyncio.run(service_for(models, gemini_video_timeout_seconds=0.02).chat(
            ChatRequest(message="analyze", session_id="s", video_url="https://youtu.be/9hE5-98ZeCg")
        ))


def test_follow_up_uses_video_context_without_reprocessing():
    models = FakeModels()
    service = service_for(models)
    result = asyncio.run(service.chat(ChatRequest(
        message="what is the first step?",
        session_id="s",
        conversation_history=[{"sender": "ASSISTANT", "content": "video_context: tofu; one step; oil unknown"}],
    )))
    assert result.reply
    assert len(models.calls) == 1
    assert isinstance(models.calls[0]["contents"], str)


def test_text_only_regression_does_not_use_video_path():
    models = FakeModels()
    result = asyncio.run(service_for(models).chat(ChatRequest(message="hello", session_id="s")))
    assert result.reply
    assert isinstance(models.calls[0]["contents"], str)


def test_minimal_json_is_parsed_and_optional_recipe_data_is_preserved():
    class TextModel:
        async def generate_content(self, **_kwargs):
            return SimpleNamespace(text='```json {"dish_name":null,"ingredients":[],"steps":[],"uncertainties":["unknown"]} ```')

    result = asyncio.run(service_for(TextModel()).chat(
        ChatRequest(message="analyze", session_id="s", video_url="https://youtu.be/9hE5-98ZeCg")
    ))
    assert result.video_analysis.dish_name is None
    assert result.video_analysis.ingredients == []
    assert "unknown" in result.video_context


def test_youtube_url_is_sent_as_video_uri_without_backend_download():
    models = FakeModels()
    url = "https://youtu.be/9hE5-98ZeCg"

    asyncio.run(service_for(models).chat(
        ChatRequest(message="analyze", session_id="s", video_url=url)
    ))

    part = models.calls[0]["contents"][0]
    assert part.file_data.file_uri == url
    assert part.file_data.mime_type == "video/mp4"


def test_malformed_or_truncated_json_fails_closed():
    class BrokenModel:
        async def generate_content(self, **_kwargs):
            return SimpleNamespace(text='{"dish_name":"dish","ingredients":["tofu"]')

    with pytest.raises(AIResponseInvalidError):
        asyncio.run(service_for(BrokenModel()).chat(
            ChatRequest(message="analyze", session_id="s", video_url="https://youtu.be/9hE5-98ZeCg")
        ))


def test_non_cooking_result_is_valid_without_fabricated_recipe():
    models = FakeModels(
        result=SimpleNamespace(
            parsed={"dish_name": None, "ingredients": [], "steps": [], "uncertainties": ["not a cooking video"]},
            usage_metadata=None,
        )
    )
    result = asyncio.run(service_for(models).chat(video_request()))
    assert result.video_analysis.ingredients == []
    assert result.video_analysis.steps == []
    assert "not a cooking video" in result.reply


def test_video_result_keeps_verified_attribution_and_structured_steps():
    result = GeminiService._build_video_result(
        GeminiVideoExtraction(dish_name="Tofu bowl", ingredients=["tofu"], steps=["Bake the tofu"], uncertainties=[]),
        VideoSource(url="https://youtu.be/9hE5-98ZeCg", title="Tofu bowl recipe", channel_name="Nutri Kitchen", metadata_verified=True, metadata_status="verified"),
    )

    assert "Tofu bowl recipe" in result.reply
    assert "Nutri Kitchen" in result.reply
    assert result.video_analysis.steps[0].instruction == "Bake the tofu"
    assert result.suggested_actions[0].type == "COOKING_INSTRUCTIONS"
