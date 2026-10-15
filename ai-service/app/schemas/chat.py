"""Schema cho giao thức Spring Boot -> FastAPI."""

from typing import Literal

import base64
import binascii

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


_IMAGE_SIGNATURES = {
    "image/jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
    "image/png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/webp": lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP",
}
_MAX_IMAGE_BYTES = 10 * 1024 * 1024


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
    health_goal: str | None = Field(default=None, min_length=1, max_length=100)
    vegetarian_type: Literal["VEGAN", "LACTO", "OVO", "LACTO_OVO"] | None = None

    @field_validator("vegetarian_type", mode="before")
    @classmethod
    def normalize_vegetarian_type(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value

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


class ChatImage(BaseModel):
    """Ephemeral image payload for one multimodal chatbot request."""

    model_config = ConfigDict(extra="forbid")

    data_base64: str = Field(min_length=1, max_length=14_000_000)
    mime_type: str = Field(min_length=1, max_length=50)

    @field_validator("mime_type", mode="before")
    @classmethod
    def normalize_mime_type(cls, value: object) -> object:
        return value.split(";", 1)[0].strip().lower() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_image_bytes(self) -> "ChatImage":
        if self.mime_type not in _IMAGE_SIGNATURES:
            raise ValueError("Ảnh phải có định dạng JPEG, PNG hoặc WebP")
        try:
            decoded = base64.b64decode(self.data_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Dữ liệu ảnh Base64 không hợp lệ") from exc
        if not decoded:
            raise ValueError("Ảnh không được rỗng")
        if len(decoded) > _MAX_IMAGE_BYTES:
            raise ValueError("Ảnh vượt quá kích thước cho phép")
        if not _IMAGE_SIGNATURES[self.mime_type](decoded):
            raise ValueError("Nội dung ảnh không khớp với định dạng đã khai báo")
        return self

    def decoded_bytes(self) -> bytes:
        return base64.b64decode(self.data_base64)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(default="", max_length=2_000)
    session_id: str = Field(min_length=1, max_length=100)
    user_context: UserContext | None = None
    image: ChatImage | None = None
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
        return normalized

    @model_validator(mode="after")
    def require_message_or_image(self) -> "ChatRequest":
        if not self.message and self.image is None:
            raise ValueError("Cần có tin nhắn hoặc ảnh")
        return self


class ChatResponse(BaseModel):
    reply: str = Field(min_length=1)
    recommendations: list[str] = Field(default_factory=list, max_length=3)
    recognized_ingredients: list[str] | None = Field(default=None, max_length=30)
    uncertain_ingredients: list[str] | None = Field(default=None, max_length=30)
    warnings: list[str] | None = Field(default=None, max_length=3)
    image_context: str | None = Field(default=None, max_length=1_000)

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
            if not isinstance(value, str):
                raise ValueError("Recommendation must be text")
            clean_value = value.strip()
            key = clean_value.casefold()
            if clean_value and key not in seen:
                normalized.append(clean_value)
                seen.add(key)
        return normalized

    @field_validator(
        "recognized_ingredients", "uncertain_ingredients", "warnings",
    )
    @classmethod
    def normalize_optional_lists(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
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
