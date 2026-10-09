"""Cấu hình lấy từ biến môi trường của AI service."""

from dataclasses import dataclass
import os
from pathlib import Path

from dotenv import load_dotenv


ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str = "NutriBot AI Service"
    app_version: str = "1.0.0"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.8-flash"
    gemini_fallback_model: str | None = "gemini-3.5-flash-lite"
    gemini_timeout_seconds: float = 14.0
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
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
            gemini_fallback_model=(
                os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite").strip()
                or None
            ),
            gemini_timeout_seconds=_positive_float("GEMINI_TIMEOUT_SECONDS", 14.0),
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
