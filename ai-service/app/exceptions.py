"""Các lỗi nghiệp vụ không làm lộ chi tiết nhà cung cấp AI."""


class AIServiceError(RuntimeError):
    """Lỗi có thể trả về an toàn cho service gọi nội bộ."""


class AIConfigurationError(AIServiceError):
    """AI service chưa được cấu hình đầy đủ."""


class AIProviderUnavailableError(AIServiceError):
    """Nhà cung cấp AI tạm thời không phản hồi."""


class AIResponseInvalidError(AIServiceError):
    """Provider response did not match the requested application schema."""


class AIQuotaExceededError(AIProviderUnavailableError):
    """Gemini từ chối do quota hoặc rate limit (HTTP 429)."""

    def __init__(self, retry_after_seconds: int | None = None) -> None:
        self.retry_after_seconds = retry_after_seconds
        super().__init__(
            "Dịch vụ AI đã đạt giới hạn sử dụng. Vui lòng thử lại sau."
        )
