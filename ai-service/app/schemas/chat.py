"""Schema cho giao thức Spring Boot -> FastAPI."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ConversationMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sender: Literal["USER", "ASSISTANT"]
    content: str = Field(min_length=1, max_length=2_000)

    @field_validator("sender", mode="before")
    @classmethod
    def normalize_sender(cls, value: object) -> object:
        return value.upper() if isinstance(value, str) else value

    @field_validator("content")
    @classmethod
    def normalize_content(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Nội dung hội thoại không được để trống")
        return normalized


class UserContext(BaseModel):
    model_config = ConfigDict(extra="ignore")

    bmi: float | None = Field(default=None, gt=0, le=100)
    allergies: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("allergies")
    @classmethod
    def normalize_allergies(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            clean_value = value.strip()
            key = clean_value.casefold()
            if clean_value and key not in seen:
                normalized.append(clean_value)
                seen.add(key)
        return normalized


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=2_000)
    session_id: str = Field(min_length=1, max_length=100)
    user_context: UserContext | None = None
    conversation_history: list[ConversationMessage] = Field(
        default_factory=list,
        max_length=50,
    )

    @field_validator("session_id", mode="before")
    @classmethod
    def normalize_session_id(cls, value: object) -> object:
        return str(value).strip() if value is not None else value

    @field_validator("message")
    @classmethod
    def normalize_message(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Tin nhắn không được để trống")
        return normalized


class ChatResponse(BaseModel):
    reply: str = Field(min_length=1)
    recommendations: list[str] = Field(default_factory=list, max_length=3)

    @field_validator("reply")
    @classmethod
    def normalize_reply(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Phản hồi AI không được để trống")
        return normalized

    @field_validator("recommendations")
    @classmethod
    def normalize_recommendations(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            clean_value = value.strip()
            key = clean_value.casefold()
            if clean_value and key not in seen:
                normalized.append(clean_value)
                seen.add(key)
        return normalized


class GeminiChatResult(ChatResponse):
    """Schema ép Gemini trả dữ liệu có cấu trúc."""
