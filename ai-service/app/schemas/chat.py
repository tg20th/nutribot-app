"""Schema cho giao thức Spring Boot -> FastAPI."""

from typing import Literal
from urllib.parse import parse_qs, urlparse
import re
import json

import base64
import binascii

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


_IMAGE_SIGNATURES = {
    "image/jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
    "image/png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/webp": lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP",
}
_MAX_IMAGE_BYTES = 10 * 1024 * 1024
_MAX_VIDEO_BASE64_LENGTH = 36_000_000
_YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
_YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_VIDEO_SIGNATURES = {
    "video/mp4": lambda data: len(data) >= 12 and data[4:8] == b"ftyp",
    "video/mov": lambda data: len(data) >= 12 and data[4:8] == b"ftyp",
    "video/3gpp": lambda data: len(data) >= 12 and data[4:8] == b"ftyp",
    "video/mpeg": lambda data: data.startswith((b"\x00\x00\x01\xba", b"\x00\x00\x01\xb3")),
    "video/mpg": lambda data: data.startswith((b"\x00\x00\x01\xba", b"\x00\x00\x01\xb3")),
    "video/avi": lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"AVI ",
    "video/x-flv": lambda data: data.startswith(b"FLV"),
    "video/webm": lambda data: data.startswith(b"\x1a\x45\xdf\xa3"),
    "video/wmv": lambda data: data.startswith(b"\x30\x26\xb2\x75\x8e\x66\xcf\x11"),
}
_MAX_VIDEO_BYTES = 25 * 1024 * 1024


def validate_youtube_url(value: str) -> str:
    """Accept only canonical public YouTube video URLs, without fetching them."""
    normalized = value.strip()
    parsed = urlparse(normalized)
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.fragment:
        raise ValueError("video_url phải là URL YouTube HTTPS công khai hợp lệ")
    host = (parsed.hostname or "").lower().rstrip(".")
    if host not in _YOUTUBE_HOSTS:
        raise ValueError("Chỉ hỗ trợ URL YouTube công khai")

    video_id: str | None = None
    if host == "youtu.be":
        if parsed.path.count("/") != 1 or not parsed.path.strip("/"):
            raise ValueError("URL YouTube phải chứa đúng một video ID")
        video_id = parsed.path.strip("/")
    elif parsed.path == "/watch":
        values = parse_qs(parsed.query, keep_blank_values=True).get("v", [])
        if len(values) != 1:
            raise ValueError("URL YouTube phải chứa video ID")
        video_id = values[0]
    else:
        parts = [part for part in parsed.path.split("/") if part]
        if len(parts) == 2 and parts[0] in {"shorts", "embed", "live"}:
            video_id = parts[1]
    if not video_id or not _YOUTUBE_ID.fullmatch(video_id):
        raise ValueError("Video ID YouTube không hợp lệ hoặc URL chỉ chứa playlist")
    return normalized


class ConversationMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sender: Literal["USER", "ASSISTANT"]
    content: str = Field(min_length=1, max_length=2_000)

    @field_validator("sender", mode="before")
    @classmethod
    def normalize_sender(cls, value: object) -> object:
        return value.upper() if isinstance(value, str) else value

    @field_validator("content", mode="before")
    @classmethod
    def normalize_content(cls, value: object) -> str:
        normalized = _normalize_legacy_history_content(value)
        if not normalized:
            raise ValueError("Nội dung hội thoại không được để trống")
        return normalized


def _normalize_legacy_history_content(value: object) -> str:
    """Convert only known legacy media envelopes into bounded text history."""
    if isinstance(value, str):
        normalized = value.strip()
        # Only parse JSON-looking strings when they contain a known media
        # envelope. Ordinary text such as "{calories: ...}" remains unchanged.
        if normalized[:1] in {"{", "["}:
            try:
                parsed = json.loads(normalized)
            except (TypeError, ValueError):
                parsed = None
            if _is_legacy_media_value(parsed):
                return _normalize_legacy_history_content(parsed)
        return normalized
    if isinstance(value, list):
        parts = [_normalize_legacy_history_content(item) for item in value]
        if all(parts):
            return " ".join(parts).strip()
        raise ValueError("History content must use supported text parts")
    if not isinstance(value, dict):
        raise ValueError("History content must be text or a supported media envelope")

    parts: list[str] = []
    for key in ("content", "reply", "text", "message"):
        if isinstance(value.get(key), str) and value[key].strip():
            parts.append(value[key].strip())
            break
    for key in ("image_context", "video_context"):
        if isinstance(value.get(key), str) and value[key].strip():
            parts.append(f"{key}: {value[key].strip()}")
    for key in ("recognized_ingredients", "uncertain_ingredients", "warnings"):
        items = value.get(key)
        if isinstance(items, list) and all(isinstance(item, str) for item in items):
            clean_items = [item.strip() for item in items if item.strip()]
            if clean_items:
                parts.append(f"{key}: {', '.join(clean_items)}")

    attachments = value.get("attachments")
    if isinstance(attachments, list):
        for attachment in attachments:
            if not isinstance(attachment, dict):
                continue
            attachment_type = attachment.get("type")
            if isinstance(attachment_type, str) and attachment_type.strip():
                parts.append(f"media_attachment: {attachment_type.strip().upper()}")

    analysis = value.get("video_analysis")
    if isinstance(analysis, dict):
        dish_name = analysis.get("dish_name") or analysis.get("dishName")
        if isinstance(dish_name, str) and dish_name.strip():
            parts.append(f"Video dish: {dish_name.strip()}")
        for key in ("ingredients", "steps", "uncertainties"):
            items = analysis.get(key)
            if isinstance(items, list):
                names = []
                for item in items:
                    if isinstance(item, str) and item.strip():
                        names.append(item.strip())
                    elif isinstance(item, dict):
                        text = item.get("name") or item.get("instruction")
                        if isinstance(text, str) and text.strip():
                            names.append(text.strip())
                if names:
                    parts.append(f"video_{key}: {', '.join(names)}")
    if parts:
        return " ".join(parts).strip()
    raise ValueError("History content is not a supported legacy format")


def _is_legacy_media_value(value: object) -> bool:
    if isinstance(value, list):
        return bool(value) and any(_is_legacy_media_value(item) for item in value)
    if not isinstance(value, dict):
        return False
    media_keys = {
        "image_context", "video_context", "recognized_ingredients",
        "uncertain_ingredients", "warnings", "video_analysis", "attachments",
    }
    if media_keys.intersection(value):
        return True
    analysis = value.get("video_analysis")
    return isinstance(analysis, dict)


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


class ChatVideo(BaseModel):
    """Ephemeral base64 video payload for one chatbot request."""

    model_config = ConfigDict(extra="forbid")

    data_base64: str = Field(min_length=1, max_length=_MAX_VIDEO_BASE64_LENGTH)
    mime_type: str = Field(min_length=1, max_length=50)
    filename: str | None = Field(default=None, max_length=255)

    @field_validator("mime_type", mode="before")
    @classmethod
    def normalize_mime_type(cls, value: object) -> object:
        return value.split(";", 1)[0].strip().lower() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_video_bytes(self) -> "ChatVideo":
        if self.mime_type not in _VIDEO_SIGNATURES:
            raise ValueError("Video phải có định dạng được Gemini hỗ trợ")
        try:
            decoded = base64.b64decode(self.data_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Dữ liệu video Base64 không hợp lệ") from exc
        if not decoded:
            raise ValueError("Video không được rỗng")
        if len(decoded) > _MAX_VIDEO_BYTES:
            raise ValueError("Video vượt quá kích thước ứng dụng cho phép (25 MB)")
        if not _VIDEO_SIGNATURES[self.mime_type](decoded):
            raise ValueError("Nội dung video không khớp với MIME type đã khai báo")
        return self

    def decoded_bytes(self) -> bytes:
        return base64.b64decode(self.data_base64)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(default="", max_length=2_000)
    session_id: str = Field(min_length=1, max_length=100)
    user_context: UserContext | None = None
    image: ChatImage | None = None
    video_url: str | None = Field(default=None, max_length=500)
    video: ChatVideo | None = None
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

    @field_validator("video_url")
    @classmethod
    def normalize_video_url(cls, value: str | None) -> str | None:
        return validate_youtube_url(value) if value else value

    @model_validator(mode="after")
    def require_message_or_image(self) -> "ChatRequest":
        if not self.message and self.image is None and self.video_url is None and self.video is None:
            raise ValueError("Cần có tin nhắn, ảnh hoặc video")
        if self.image is not None and (self.video_url is not None or self.video is not None):
            raise ValueError("Không thể gửi ảnh cùng video")
        if self.video_url is not None and self.video is not None:
            raise ValueError("Chỉ được gửi một video_url hoặc một video tải lên")
        return self


class GeminiVideoExtraction(BaseModel):
    """Minimal model output requested from Gemini for video extraction."""

    model_config = ConfigDict(extra="ignore")

    dish_name: str | None = None
    ingredients: list[str] = Field(default_factory=list, max_length=30)
    steps: list[str] = Field(default_factory=list, max_length=50)
    uncertainties: list[str] = Field(default_factory=list, max_length=10)


class GeminiTextChatResult(BaseModel):
    """Stable Gemini schema for text and image paths; excludes video fields."""

    model_config = ConfigDict(extra="ignore")

    reply: str = Field(min_length=1)
    recommendations: list[str] = Field(default_factory=list, max_length=3)
    recognized_ingredients: list[str] | None = Field(default=None, max_length=30)
    uncertain_ingredients: list[str] | None = Field(default=None, max_length=30)
    warnings: list[str] | None = Field(default=None, max_length=3)
    image_context: str | None = Field(default=None, max_length=1_000)


class ChatResponse(BaseModel):
    reply: str = Field(min_length=1)
    recommendations: list[str] = Field(default_factory=list, max_length=3)
    recognized_ingredients: list[str] | None = Field(default=None, max_length=30)
    uncertain_ingredients: list[str] | None = Field(default=None, max_length=30)
    warnings: list[str] | None = Field(default=None, max_length=3)
    image_context: str | None = Field(default=None, max_length=1_000)
    video_analysis: "VideoAnalysis | None" = None
    video_context: str | None = Field(default=None, max_length=2_000)

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


class VideoIngredient(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    quantity: str | None = Field(default=None, max_length=100)
    note: str | None = Field(default=None, max_length=200)


class VideoStep(BaseModel):
    order: int = Field(ge=1, le=100)
    instruction: str = Field(min_length=1, max_length=500)


class VideoAnalysis(BaseModel):
    dish_name: str | None = Field(default=None, max_length=200)
    ingredients: list[VideoIngredient] = Field(default_factory=list, max_length=30)
    steps: list[VideoStep] = Field(default_factory=list, max_length=50)
    uncertainties: list[str] = Field(default_factory=list, max_length=10)
