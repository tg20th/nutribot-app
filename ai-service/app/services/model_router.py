"""Task-aware Gemini model selection with process-local cooldowns."""

from dataclasses import dataclass
import time
from typing import Any

from app.exceptions import AIProviderUnavailableError, AIQuotaExceededError


TEXT_TASK = "text"
IMAGE_TASK = "image"
COMPLEX_TASK = "complex"
VIDEO_TASK = "video"


@dataclass
class ModelAvailability:
    model: str
    tasks: frozenset[str]
    cooldown_until: float = 0.0
    last_error: str | None = None
    last_status: int | None = None

    @property
    def eligible(self) -> bool:
        return time.monotonic() >= self.cooldown_until


class ModelAvailabilityTracker:
    """Process-local model health state; cooldowns reset when the process restarts."""

    def __init__(self, models: dict[str, set[str]]) -> None:
        self._models = {
            name: ModelAvailability(name, frozenset(tasks))
            for name, tasks in models.items()
            if name
        }

    def can_use(self, model: str, task: str) -> bool:
        state = self._models.get(model)
        return bool(state and task in state.tasks and state.eligible)

    def quota_cooling(self, model: str, task: str) -> bool:
        state = self._models.get(model)
        return bool(
            state
            and task in state.tasks
            and state.last_status == 429
            and not state.eligible
        )

    def candidates(self, models: list[str], task: str) -> list[str]:
        return [model for model in dict.fromkeys(models) if self.can_use(model, task)]

    def mark_failure(
        self,
        model: str,
        status: int | None,
        error: str,
        retry_after_seconds: int | None = None,
    ) -> None:
        state = self._models.get(model)
        if state is None:
            return
        if status == 429:
            cooldown = retry_after_seconds if retry_after_seconds is not None else 60
        elif status in {500, 502, 503, 504}:
            cooldown = 15
        else:
            cooldown = 5
        state.cooldown_until = time.monotonic() + max(1, cooldown)
        state.last_status = status
        state.last_error = error

    def mark_success(self, model: str) -> None:
        state = self._models.get(model)
        if state is not None:
            state.cooldown_until = 0.0
            state.last_status = None
            state.last_error = None

    def all_quota_exhausted(self, models: list[str], task: str) -> bool:
        relevant = [self._models.get(model) for model in dict.fromkeys(models)]
        relevant = [state for state in relevant if state and task in state.tasks]
        return bool(relevant) and all(
            state.last_status == 429 and not state.eligible for state in relevant
        )

    def snapshot(self) -> list[dict[str, Any]]:
        return [
            {
                "model": state.model,
                "tasks": sorted(state.tasks),
                "eligible": state.eligible,
                "cooldown_until": state.cooldown_until,
                "last_status": state.last_status,
            }
            for state in self._models.values()
        ]


class GeminiModelRouter:
    """Selects a primary and at most one compatible alternative per task."""

    def __init__(self, settings: Any) -> None:
        self._settings = settings
        routine = settings.gemini_routine_model
        routine_alt = settings.gemini_routine_alternative_model
        image = settings.gemini_image_model
        image_alt = settings.gemini_image_alternative_model
        complex_model = settings.gemini_complex_model
        video = settings.gemini_video_model
        self._routine_primary = routine
        self._routine_alternative = routine_alt
        self._image_primary = image
        self._image_alternative = image_alt
        all_tasks = {TEXT_TASK, IMAGE_TASK, COMPLEX_TASK}
        model_tasks = [
            (routine, all_tasks),
            (routine_alt, all_tasks),
            (image, {IMAGE_TASK, COMPLEX_TASK}),
            (image_alt, {IMAGE_TASK, COMPLEX_TASK}),
            (complex_model, {TEXT_TASK, COMPLEX_TASK, IMAGE_TASK}),
            (settings.gemini_complex_alternative_model, {TEXT_TASK, COMPLEX_TASK, IMAGE_TASK}),
            (video, {VIDEO_TASK}),
            (settings.gemini_video_alternative_model, {VIDEO_TASK}),
        ]
        models: dict[str, set[str]] = {}
        for model, tasks in model_tasks:
            models.setdefault(model, set()).update(tasks)
        self._tracker = ModelAvailabilityTracker(models)

    def candidates(self, task: str) -> list[str]:
        if task == "legacy":
            configured = [self._settings.gemini_model, self._settings.gemini_fallback_model]
        elif task == IMAGE_TASK:
            configured = [self._image_primary, self._image_alternative]
        elif task == COMPLEX_TASK:
            configured = [
                self._settings.gemini_complex_model,
                self._settings.gemini_complex_alternative_model,
            ]
        elif task == VIDEO_TASK:
            configured = [
                self._settings.gemini_video_model,
                self._settings.gemini_video_alternative_model,
            ]
        else:
            configured = [self._routine_primary, self._routine_alternative]
        if task == VIDEO_TASK:
            configured = [
                model
                for model in configured
                if model in self._settings.gemini_video_capable_models
            ]
        if (
            configured
            and self._tracker.quota_cooling(configured[0], task)
            and not self._settings.gemini_alternative_quota_independent
        ):
            return []
        return self._tracker.candidates(configured, task)

    def mark_failure(self, model: str, status: int | None, error: str, retry_after: int | None = None) -> None:
        self._tracker.mark_failure(model, status, error, retry_after)

    def mark_success(self, model: str) -> None:
        self._tracker.mark_success(model)

    def all_quota_exhausted(self, task: str) -> bool:
        if task == "legacy":
            models = [self._settings.gemini_model, self._settings.gemini_fallback_model]
        elif task == IMAGE_TASK:
            models = [self._image_primary, self._image_alternative]
        elif task == COMPLEX_TASK:
            models = [self._settings.gemini_complex_model, self._settings.gemini_complex_alternative_model]
        elif task == VIDEO_TASK:
            models = [self._settings.gemini_video_model, self._settings.gemini_video_alternative_model]
        else:
            models = [self._routine_primary, self._routine_alternative]
        if (
            models
            and self._tracker.quota_cooling(models[0], task)
            and not self._settings.gemini_alternative_quota_independent
        ):
            return True
        return self._tracker.all_quota_exhausted(models, task)

    def unavailable_error(self, task: str) -> AIProviderUnavailableError:
        if self.all_quota_exhausted(task):
            return AIQuotaExceededError()
        return AIProviderUnavailableError(
            "AI is temporarily unavailable. Please try again later."
        )

    def snapshot(self) -> list[dict[str, Any]]:
        return self._tracker.snapshot()
