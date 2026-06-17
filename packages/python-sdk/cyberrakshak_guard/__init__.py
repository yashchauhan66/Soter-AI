"""CyberRakshak Guard — Python SDK.

Protect any Python chatbot in 3 lines of code::

    from cyberrakshak_guard import CyberRakshakGuard
    guard = CyberRakshakGuard()  # reads CYBERRAKSHAK_API_KEY
    result = guard.protect_chat(message=user_message, call_llm=my_llm)
"""

from __future__ import annotations

from .client import CyberRakshakGuard
from .exceptions import (
    CyberRakshakAuthError,
    CyberRakshakConfigError,
    CyberRakshakError,
    CyberRakshakNetworkError,
    CyberRakshakRateLimitError,
    CyberRakshakValidationError,
)
from .types import (
    ExcludedRagSource,
    GuardFinding,
    GuardResult,
    ProtectChatResult,
    ProtectRagResult,
    RagSource,
    SafeRagSource,
)

__version__ = "0.2.0"


def __getattr__(name: str):
    # Lazy import so the async client (and its httpx dependency) is only loaded
    # when actually used.
    if name in ("AsyncCyberRakshakGuard",):
        from .async_client import AsyncCyberRakshakGuard

        return AsyncCyberRakshakGuard
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "CyberRakshakGuard",
    "AsyncCyberRakshakGuard",
    "GuardResult",
    "GuardFinding",
    "RagSource",
    "SafeRagSource",
    "ExcludedRagSource",
    "ProtectChatResult",
    "ProtectRagResult",
    "CyberRakshakError",
    "CyberRakshakConfigError",
    "CyberRakshakAuthError",
    "CyberRakshakRateLimitError",
    "CyberRakshakValidationError",
    "CyberRakshakNetworkError",
    "__version__",
]
