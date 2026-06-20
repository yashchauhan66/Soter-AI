"""Exception hierarchy for the Soter Python SDK.

All errors raised by the SDK inherit from :class:`SoterError` (or the legacy
:class:`CyberRakshakError`), so a single ``except SoterError`` clause is enough
to catch everything the SDK can throw.
"""

from __future__ import annotations

from typing import Any, Optional


class CyberRakshakError(Exception):
    """Base class for every error raised by the SDK (legacy name)."""

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


class CyberRakshakConfigError(CyberRakshakError):
    """Raised when the client is misconfigured (e.g. missing API key) (legacy name)."""

    def __init__(self, message: str, *, details: Any = None) -> None:
        super().__init__(message, code="config_error", details=details)


class CyberRakshakAuthError(CyberRakshakError):
    """Raised on 401/403 responses (missing, invalid, or disabled key) (legacy name)."""

    def __init__(self, message: str, status: int, *, details: Any = None) -> None:
        super().__init__(message, status=status, code="auth_error", details=details)


class CyberRakshakRateLimitError(CyberRakshakError):
    """Raised on 429 responses. ``retry_after`` is seconds when provided (legacy name)."""

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


class CyberRakshakValidationError(CyberRakshakError):
    """Raised on 400 responses (the request body failed validation) (legacy name)."""

    def __init__(self, message: str, status: int, *, details: Any = None) -> None:
        super().__init__(message, status=status, code="validation_error", details=details)


class CyberRakshakNetworkError(CyberRakshakError):
    """Raised when the request never reached the server (timeout, DNS, etc.) (legacy name)."""

    def __init__(self, message: str, *, cause: Any = None) -> None:
        super().__init__(message, code="network_error", details=cause)
        self.__cause__ = cause if isinstance(cause, BaseException) else None


# ─── Soter-branded aliases ───────────────────────────────────────────────────

SoterError = CyberRakshakError
SoterConfigError = CyberRakshakConfigError
SoterAuthError = CyberRakshakAuthError
SoterRateLimitError = CyberRakshakRateLimitError
SoterValidationError = CyberRakshakValidationError
SoterNetworkError = CyberRakshakNetworkError


__all__ = [
    "CyberRakshakError",
    "CyberRakshakConfigError",
    "CyberRakshakAuthError",
    "CyberRakshakRateLimitError",
    "CyberRakshakValidationError",
    "CyberRakshakNetworkError",
    "SoterError",
    "SoterConfigError",
    "SoterAuthError",
    "SoterRateLimitError",
    "SoterValidationError",
    "SoterNetworkError",
]
