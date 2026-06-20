"""Exception classes — re-exported from cyberrakshak_guard for the soter namespace."""

from __future__ import annotations

from cyberrakshak_guard.exceptions import (  # noqa: F401
    CyberRakshakAuthError,
    CyberRakshakConfigError,
    CyberRakshakError,
    CyberRakshakNetworkError,
    CyberRakshakRateLimitError,
    CyberRakshakValidationError,
    SoterAuthError,
    SoterConfigError,
    SoterError,
    SoterNetworkError,
    SoterRateLimitError,
    SoterValidationError,
)

__all__ = [
    "SoterError",
    "SoterConfigError",
    "SoterAuthError",
    "SoterRateLimitError",
    "SoterValidationError",
    "SoterNetworkError",
    "CyberRakshakError",
    "CyberRakshakConfigError",
    "CyberRakshakAuthError",
    "CyberRakshakRateLimitError",
    "CyberRakshakValidationError",
    "CyberRakshakNetworkError",
]
