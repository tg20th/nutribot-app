"""Cấu hình lấy từ biến môi trường của AI service."""

from dataclasses import dataclass
import os
from pathlib import Path

from dotenv import load_dotenv


ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
_DEPRECATED_MODELS = {"gemini-3.7-flash"}


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str = "NutriBot AI Service"
    app_version: str = "1.0.0"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_fallback_model: str | None = "gemini-3.6-flash"
    gemini_routine_model: str = "gemini-3.5-flash-lite"
    gemini_routine_alternative_model: str = "gemini-3.6-flash"
    gemini_image_model: str = "gemini-3.5-flash-lite"
    gemini_image_alternative_model: str = "gemini-3.6-flash"
    gemini_complex_model: str = "gemini-3.5-flash-lite"
    gemini_complex_alternative_model: str = "gemini-3.6-flash"
    gemini_video_model: str = "gemini-3.5-flash-lite"
    gemini_video_alternative_model: str = "gemini-3.6-flash"
    gemini_video_capable_models: tuple[str, ...] = (
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash",
    )
    gemini_alternative_quota_independent: bool = False
    gemini_timeout_seconds: float = 30.0
    gemini_image_timeout_seconds: float = 45.0
    gemini_image_attempt_timeout_seconds: float = 45.0
    gemini_video_timeout_seconds: float = 120.0
    gemini_video_attempt_timeout_seconds: float = 120.0
    gemini_video_poll_interval_seconds: float = 2.0
    gemini_video_max_poll_seconds: float = 120.0
    gemini_video_max_bytes: int = 25 * 1024 * 1024
    gemini_video_max_duration_seconds: int = 60
    max_history_messages: int = 6

    @property
    def gemini_configured(self) -> bool:
        if not self.gemini_api_key or not self.gemini_api_key.strip():
            return False
        return self.gemini_api_key.strip() != "your_gemini_api_key_here"

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv(ENV_FILE, override=False)
        return cls(
            gemini_api_key=os.getenv("GEMINI_API_KEY"),
            gemini_model=_model_env("GEMINI_MODEL", None, "gemini-3.5-flash-lite"),
            gemini_fallback_model=(
                _model_env("GEMINI_FALLBACK_MODEL", None, "gemini-3.6-flash")
                or None
            ),
            gemini_routine_model=_model_env("GEMINI_ROUTINE_MODEL", None, "gemini-3.5-flash-lite"),
            gemini_routine_alternative_model=_model_env("GEMINI_ROUTINE_ALTERNATIVE_MODEL", None, "gemini-3.6-flash"),
            gemini_image_model=_model_env("GEMINI_IMAGE_MODEL", None, "gemini-3.5-flash-lite"),
            gemini_image_alternative_model=_model_env("GEMINI_IMAGE_ALTERNATIVE_MODEL", None, "gemini-3.6-flash"),
            gemini_complex_model=_model_env("GEMINI_COMPLEX_MODEL", None, "gemini-3.5-flash-lite"),
            gemini_complex_alternative_model=_model_env("GEMINI_COMPLEX_ALTERNATIVE_MODEL", None, "gemini-3.6-flash"),
            gemini_video_model=_model_env("GEMINI_VIDEO_MODEL", None, "gemini-3.5-flash-lite"),
            gemini_video_alternative_model=_model_env("GEMINI_VIDEO_ALTERNATIVE_MODEL", None, "gemini-3.6-flash"),
            gemini_video_capable_models=_model_list(
                "GEMINI_VIDEO_CAPABLE_MODELS",
                "gemini-3.5-flash-lite,gemini-3.6-flash",
            ),
            gemini_alternative_quota_independent=_bool_env("GEMINI_ALTERNATIVE_QUOTA_INDEPENDENT", False),
            gemini_timeout_seconds=_positive_float("GEMINI_TIMEOUT_SECONDS", 30.0),
            gemini_image_timeout_seconds=_positive_float(
                "GEMINI_IMAGE_TIMEOUT_SECONDS", 45.0
            ),
            gemini_image_attempt_timeout_seconds=_minimum_float(
                "GEMINI_IMAGE_ATTEMPT_TIMEOUT_SECONDS", 45.0, 10.0
            ),
            gemini_video_timeout_seconds=_positive_float(
                "GEMINI_VIDEO_TIMEOUT_SECONDS", 120.0
            ),
            gemini_video_attempt_timeout_seconds=_minimum_float(
                "GEMINI_VIDEO_ATTEMPT_TIMEOUT_SECONDS", 120.0, 5.0
            ),
            gemini_video_poll_interval_seconds=_positive_float(
                "GEMINI_VIDEO_POLL_INTERVAL_SECONDS", 2.0
            ),
            gemini_video_max_poll_seconds=_positive_float(
                "GEMINI_VIDEO_MAX_POLL_SECONDS", 120.0
            ),
            gemini_video_max_bytes=_positive_int(
                "GEMINI_VIDEO_MAX_BYTES", 25 * 1024 * 1024
            ),
            gemini_video_max_duration_seconds=_positive_int(
                "GEMINI_VIDEO_MAX_DURATION_SECONDS", 60
            ),
            max_history_messages=_positive_int("MAX_HISTORY_MESSAGES", 6),
        )


def _positive_float(name: str, default: float) -> float:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        value = float(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} phải là một số") from exc
    if value <= 0:
        raise ValueError(f"{name} phải lớn hơn 0")
    return value


def _model_env(name: str, fallback_name: str | None, default: str) -> str:
    value = os.getenv(name)
    if value is None and fallback_name:
        value = os.getenv(fallback_name)
    return _normalize_model(value or default, default)


def _normalize_model(value: str, default: str) -> str:
    model = value.strip()
    return default if model in _DEPRECATED_MODELS else model


def _bool_env(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    normalized = raw_value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean")


def _model_list(name: str, default: str) -> tuple[str, ...]:
    raw_value = os.getenv(name, default)
    models = tuple(
        _normalize_model(item, "")
        for item in raw_value.split(",")
        if item.strip() and item.strip() not in _DEPRECATED_MODELS
    )
    if not models:
        raise ValueError(f"{name} must contain at least one model")
    return models


def _positive_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} phải là số nguyên") from exc
    if value <= 0:
        raise ValueError(f"{name} phải lớn hơn 0")
    return value
def _minimum_float(name: str, default: float, minimum: float) -> float:
    value = _positive_float(name, default)
    if value < minimum:
        raise ValueError(f"{name} must be at least {minimum} seconds")
    return value
