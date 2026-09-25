"""Các lỗi nghiệp vụ không làm lộ chi tiết nhà cung cấp AI."""


class AIServiceError(RuntimeError):
    """Lỗi có thể trả về an toàn cho service gọi nội bộ."""


class AIConfigurationError(AIServiceError):
    """AI service chưa được cấu hình đầy đủ."""


class AIProviderUnavailableError(AIServiceError):
    """Nhà cung cấp AI tạm thời không phản hồi."""
