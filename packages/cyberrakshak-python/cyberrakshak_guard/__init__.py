"""CyberRakshak Guard — Python SDK.

OWASP LLM Top 10 aligned AI security gateway client. Provides input/output
guarding, a public analyzer, and conversation helpers for chatbots, RAG apps,
and AI agents.

This SDK reduces risk through detection, redaction, blocking, monitoring, and
reporting. It does not guarantee complete protection.
"""
from .client import CyberRakshakClient
from .errors import (
    CyberRakshakAuthError,
    CyberRakshakConfigError,
    CyberRakshakError,
    CyberRakshakNetworkError,
    CyberRakshakRateLimitError,
    CyberRakshakValidationError,
)
from .types import GuardFinding, GuardResult, normalize_decision

__all__ = [
    "CyberRakshakClient",
    "GuardResult",
    "GuardFinding",
    "normalize_decision",
    "CyberRakshakError",
    "CyberRakshakConfigError",
    "CyberRakshakAuthError",
    "CyberRakshakRateLimitError",
    "CyberRakshakValidationError",
    "CyberRakshakNetworkError",
]

__version__ = "0.1.0"
