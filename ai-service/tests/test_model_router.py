from types import SimpleNamespace

import pytest

from app.exceptions import AIQuotaExceededError
from app.services.model_router import (
    COMPLEX_TASK,
    IMAGE_TASK,
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
