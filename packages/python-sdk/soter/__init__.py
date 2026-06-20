"""Soter — Python SDK.

Protect any Python chatbot in 3 lines of code::

    from soter import Soter
    guard = Soter()  # reads SOTER_API_KEY / CYBERRAKSHAK_API_KEY
    result = guard.protect_chat(message=user_message, call_llm=my_llm)
"""

from __future__ import annotations

from cyberrakshak_guard import (  # noqa: F401 — public re-export
    AsyncCyberRakshakGuard,
    AsyncSoter,
    CyberRakshakAuthError,
    CyberRakshakConfigError,
    CyberRakshakError,
    CyberRakshakGuard,
    CyberRakshakNetworkError,
    CyberRakshakRateLimitError,
    CyberRakshakValidationError,
    ExcludedRagSource,
    GuardFinding,
    GuardResult,
    ProtectChatResult,
    ProtectRagResult,
    RagSource,
    SafeRagSource,
    Soter,
    SoterAuthError,
    SoterConfigError,
    SoterError,
    SoterNetworkError,
    SoterRateLimitError,
    SoterValidationError,
    __version__,
)

__all__ = [
    "Soter",
    "CyberRakshakGuard",
    "AsyncCyberRakshakGuard",
    "AsyncSoter",
    "GuardResult",
    "GuardFinding",
    "RagSource",
    "SafeRagSource",
    "ExcludedRagSource",
    "ProtectChatResult",
    "ProtectRagResult",
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
    "__version__",
]
