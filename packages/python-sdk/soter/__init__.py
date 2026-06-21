"""Soter — Python SDK.

Protect any Python chatbot in 3 lines of code::

    from soter import Soter
    guard = Soter()  # reads SOTER_API_KEY
    result = guard.protect_chat(message=user_message, call_llm=my_llm)
"""

from __future__ import annotations

from .client import Soter
from .exceptions import (
    SoterAuthError,
    SoterConfigError,
    SoterError,
    SoterNetworkError,
    SoterRateLimitError,
    SoterValidationError,
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

__version__ = "0.2.1"

def __getattr__(name: str):
    # Lazy import so the async client (and its httpx dependency) is only loaded
    # when actually used.
    if name == "AsyncSoter":
        from .async_client import AsyncSoter

        return AsyncSoter
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "Soter",
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
    "__version__",
]
