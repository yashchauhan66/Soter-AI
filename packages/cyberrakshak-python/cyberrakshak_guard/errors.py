"""Exception hierarchy for the CyberRakshak Guard Python SDK.

Error messages never contain the API key.
"""
from __future__ import annotations

from typing import Any, Optional


class CyberRakshakError(Exception):
    """Base class for all SDK errors."""

    code = "guard_error"

    def __init__(
        self,
        message: str,
        *,
        status: Optional[int] = None,
        code: Optional[str] = None,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        if code:
            self.code = code
        self.details = details


class CyberRakshakConfigError(CyberRakshakError):
    code = "config_error"


class CyberRakshakAuthError(CyberRakshakError):
    code = "auth_error"


class CyberRakshakRateLimitError(CyberRakshakError):
    code = "rate_limited"

    def __init__(self, message: str, *, status: int, retry_after: Optional[int] = None) -> None:
        super().__init__(message, status=status, code=self.code)
        self.retry_after = retry_after


class CyberRakshakValidationError(CyberRakshakError):
    code = "validation_error"


class CyberRakshakNetworkError(CyberRakshakError):
    code = "network_error"
