import asyncio
from types import SimpleNamespace

import pytest

from app.exceptions import AIQuotaExceededError
from app.services.model_router import (
    COMPLEX_TASK,
    IMAGE_TASK,
    LEGACY_TASK,
    TEXT_TASK,
    VIDEO_TASK,
    GeminiModelRouter,
)
from app.config import Settings


def settings(**overrides):
    values = dict(
        gemini_model="gemini-3.5-flash-lite",
        gemini_fallback_model="gemini-3.6-flash",
        gemini_routine_model="gemini-3.5-flash-lite",
        gemini_routine_alternative_model="gemini-3.6-flash",
        gemini_image_model="gemini-3.5-flash-lite",
        gemini_image_alternative_model="gemini-3.6-flash",
        gemini_complex_model="gemini-3.5-flash-lite",
        gemini_complex_alternative_model="gemini-3.6-flash",
        gemini_video_model="gemini-3.5-flash-lite",
        gemini_video_alternative_model="gemini-3.6-flash",
        gemini_video_capable_models=("gemini-3.5-flash-lite", "gemini-3.6-flash"),
        gemini_alternative_quota_independent=False,
    )
    values.update(overrides)
    return SimpleNamespace(**values)


def test_routes_each_task_to_configured_compatible_models():
    router = GeminiModelRouter(settings())

    assert router.candidates(LEGACY_TASK) == ["gemini-3.5-flash-lite", "gemini-3.6-flash"]
    assert router.candidates(TEXT_TASK) == ["gemini-3.5-flash-lite", "gemini-3.6-flash"]
    assert router.candidates(IMAGE_TASK) == ["gemini-3.5-flash-lite", "gemini-3.6-flash"]
    assert router.candidates(COMPLEX_TASK) == ["gemini-3.5-flash-lite", "gemini-3.6-flash"]
    assert router.candidates(VIDEO_TASK) == ["gemini-3.5-flash-lite", "gemini-3.6-flash"]


def test_default_chatbot_models_are_lightweight_first():
    configured = Settings()

    assert configured.gemini_model == "gemini-3.5-flash-lite"
    assert configured.gemini_fallback_model == "gemini-3.6-flash"
    assert configured.gemini_image_model == "gemini-3.5-flash-lite"
    assert configured.gemini_video_model == "gemini-3.5-flash-lite"
    assert configured.gemini_video_alternative_model == "gemini-3.6-flash"
    assert "gemini-3.7-flash" not in configured.gemini_video_capable_models


def test_generic_pipeline_model_does_not_override_chatbot_routing():
    router = GeminiModelRouter(settings(
        gemini_model="planner-model",
        gemini_fallback_model="planner-fallback",
    ))

    assert router.candidates(TEXT_TASK) == ["gemini-3.5-flash-lite", "gemini-3.6-flash"]
    assert router.candidates(IMAGE_TASK) == ["gemini-3.5-flash-lite", "gemini-3.6-flash"]
    assert router.candidates(VIDEO_TASK) == ["gemini-3.5-flash-lite", "gemini-3.6-flash"]


def test_custom_legacy_models_are_registered():
    router = GeminiModelRouter(settings(
        gemini_model="legacy-primary",
        gemini_fallback_model="legacy-fallback",
    ))

    assert router.candidates(LEGACY_TASK) == ["legacy-primary", "legacy-fallback"]


def test_legacy_routing_reaches_gemini_call_with_mocked_client():
    from app.config import Settings
    from app.services.gemini_service import GeminiService

    class RecordingModels:
        def __init__(self):
            self.calls = []

        async def generate_content(self, **kwargs):
            self.calls.append(kwargs)
            return SimpleNamespace(text='{"ok": true}')

    models = RecordingModels()
    service = GeminiService(
        Settings(gemini_model="legacy-primary", gemini_fallback_model="legacy-fallback"),
        client=SimpleNamespace(aio=SimpleNamespace(models=models)),
    )

    response = asyncio.run(service._generate_with_fallback(
        client=service._get_client(),
        prompt="legacy test",
        config=SimpleNamespace(),
    ))

    assert response.text == '{"ok": true}'
    assert [call["model"] for call in models.calls] == ["legacy-primary"]


def test_legacy_cooldown_blocks_unverified_alternative():
    router = GeminiModelRouter(settings())
    router.mark_failure("gemini-3.5-flash-lite", 429, "quota", 60)

    assert router.candidates(LEGACY_TASK) == []
    with pytest.raises(AIQuotaExceededError):
        raise router.unavailable_error(LEGACY_TASK)


def test_legacy_empty_when_all_registered_models_are_in_cooldown():
    router = GeminiModelRouter(settings(
        gemini_model="legacy-primary",
        gemini_fallback_model="legacy-fallback",
    ))
    router.mark_failure("legacy-primary", 503, "provider unavailable")
    router.mark_failure("legacy-fallback", 503, "provider unavailable")

    assert router.candidates(LEGACY_TASK) == []


def test_quota_cooldown_blocks_same_model_and_unverified_alternative():
    router = GeminiModelRouter(settings())
    router.mark_failure("gemini-3.5-flash-lite", 429, "quota", 60)

    assert router.candidates(TEXT_TASK) == []
    with pytest.raises(AIQuotaExceededError):
        raise router.unavailable_error(TEXT_TASK)


def test_verified_independent_alternative_can_be_selected_after_429():
    router = GeminiModelRouter(settings(gemini_alternative_quota_independent=True))
    router.mark_failure("gemini-3.5-flash-lite", 429, "quota", 60)

    assert router.candidates(TEXT_TASK) == ["gemini-3.6-flash"]


def test_cooldown_expiration_reenables_model(monkeypatch):
    now = [100.0]
    monkeypatch.setattr("app.services.model_router.time.monotonic", lambda: now[0])
    router = GeminiModelRouter(settings())
    router.mark_failure("gemini-3.5-flash-lite", 429, "quota", 10)
    assert router.candidates(TEXT_TASK) == []

    now[0] += 11
    assert router.candidates(TEXT_TASK)[0] == "gemini-3.5-flash-lite"
