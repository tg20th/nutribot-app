"""Validated, privacy-minimal input and output contracts for NB-59."""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

ContentType = Literal["BLOG", "VIDEO"]
Visibility = Literal["PUBLISHED", "DRAFT", "REJECTED", "ARCHIVED", "FLAGGED", "UNDER_REVIEW"]

class ContentCandidate(BaseModel):
    """Canonical content supplied by Backend; only PUBLISHED is eligible."""
    model_config = ConfigDict(extra="forbid")
    content_id: int = Field(gt=0)
    content_type: ContentType
    status: Visibility
    title: str = Field(min_length=1, max_length=255)
    body: str | None = None
    description: str | None = None
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    ingredients: list[str] = Field(default_factory=list)
    dietary_tags: list[str] = Field(default_factory=list)
    view_count: int = Field(default=0, ge=0)
    published_at: datetime | None = None
    @field_validator("content_type", "status", mode="before")
    @classmethod
    def normalize_enum(cls, value: object) -> object:
        """Accept Backend's lower-case database values while retaining one internal policy."""
        return value.upper() if isinstance(value, str) else value

class Interaction(BaseModel):
    """One current-user event. Dwell must be active time, never tab-open time."""
    model_config = ConfigDict(extra="forbid")
    content_id: int = Field(gt=0)
    vote: int | None = Field(default=None, ge=-1, le=1)
    active_dwell_seconds: float | None = Field(default=None, ge=0)
    max_scroll_pct: float | None = Field(default=None, ge=0, le=100)
    completed: bool | None = None

class RecommendationRequest(BaseModel):
    """Backend-to-AI contract; it must contain only the authenticated user's data."""
    model_config = ConfigDict(extra="forbid")
    contents: list[ContentCandidate] = Field(default_factory=list, max_length=5000)
    interactions: list[Interaction] = Field(default_factory=list, max_length=1000)
    vegetarian_type: Literal["VEGAN", "LACTO", "OVO", "LACTO_OVO"] | None = None
    limit: int = Field(default=10, ge=1, le=50)

class RecommendationItem(BaseModel):
    content_id: int
    content_type: ContentType
    score: float
    reason: Literal["personalized", "cold_start"]

class RecommendationResponse(BaseModel):
    items: list[RecommendationItem]
    embedding_model: str
