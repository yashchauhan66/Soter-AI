"""Exception hierarchy for the Soter Python SDK."""

from __future__ import annotations

from typing import Any, Optional


class SoterError(Exception):
    """Base class for every error raised by the SDK."""

    def __init__(
        self,
        message: str,
        *,
        status: Optional[int] = None,
        code: str = "guard_error",
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.details = details


class SoterConfigError(SoterError):
    """Raised when the client is misconfigured, such as a missing API key."""

    def __init__(self, message: str, *, details: Any = None) -> None:
        super().__init__(message, code="config_error", details=details)


class SoterAuthError(SoterError):
    """Raised on 401/403 responses for a missing, invalid, or disabled key."""

    def __init__(self, message: str, status: int, *, details: Any = None) -> None:
        super().__init__(message, status=status, code="auth_error", details=details)


class SoterRateLimitError(SoterError):
    """Raised on 429 responses. ``retry_after`` is seconds when provided."""

    def __init__(
        self,
        message: str,
        status: int,
        *,
        retry_after: Optional[int] = None,
        details: Any = None,
    ) -> None:
        super().__init__(message, status=status, code="rate_limited", details=details)
        self.retry_after = retry_after


class SoterValidationError(SoterError):
    """Raised on 400 responses when the request body fails validation."""

    def __init__(self, message: str, status: int, *, details: Any = None) -> None:
        super().__init__(message, status=status, code="validation_error", details=details)


class SoterNetworkError(SoterError):
    """Raised when the request never reached the server."""

    def __init__(self, message: str, *, cause: Any = None) -> None:
        super().__init__(message, code="network_error", details=cause)
        self.__cause__ = cause if isinstance(cause, BaseException) else None


__all__ = [
    "SoterError",
    "SoterConfigError",
    "SoterAuthError",
    "SoterRateLimitError",
    "SoterValidationError",
    "SoterNetworkError",
]
