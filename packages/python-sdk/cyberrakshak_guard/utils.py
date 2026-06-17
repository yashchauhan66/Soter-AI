"""Shared, transport-agnostic helpers for the CyberRakshak Guard SDK.

These functions hold the logic common to the sync and async clients so the two
clients stay byte-for-byte consistent in their decisions. Nothing here performs
I/O; the clients inject already-fetched :class:`GuardResult` objects.
"""

from __future__ import annotations

import inspect
import os
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

from .exceptions import CyberRakshakConfigError
from .types import (
    ExcludedRagSource,
    GuardResult,
    LLM_SAFE_ACTIONS,
    RagSource,
    SafeRagSource,
)

DEFAULT_BASE_URL = "https://api.cyberrakshak.com"
DEFAULT_TIMEOUT = 8.0
USER_AGENT = "cyberrakshak-guard-python/0.2.0"

DEFAULT_BLOCKED_RESPONSE = "This request was blocked for security reasons."
DEFAULT_OUTPUT_BLOCKED_RESPONSE = "The assistant response was blocked for security reasons."


def resolve_config(
    api_key: Optional[str],
    base_url: Optional[str],
    timeout: Optional[float],
) -> Tuple[str, str, float]:
    """Resolve config from explicit args, then env vars, then defaults.

    Raises :class:`CyberRakshakConfigError` when no API key can be found.
    """
    key = api_key or os.environ.get("CYBERRAKSHAK_API_KEY") or ""
    if not key:
        raise CyberRakshakConfigError(
            "Missing API key. Pass api_key=... or set the CYBERRAKSHAK_API_KEY "
            "environment variable. Never embed the key in frontend/client code."
        )
    url = (base_url or os.environ.get("CYBERRAKSHAK_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
    resolved_timeout = timeout if timeout is not None else DEFAULT_TIMEOUT
    return key, url, resolved_timeout


def redact_key(api_key: str) -> str:
    """Return a log-safe fingerprint of an API key (never the full value)."""
    if not api_key:
        return "<none>"
    if len(api_key) <= 8:
        return "***"
    return f"{api_key[:4]}…{api_key[-2:]}"


def base_headers(api_key: Optional[str], extra: Optional[Dict[str, str]]) -> Dict[str, str]:
    """Build request headers. The API key only ever goes in ``x-api-key``."""
    headers: Dict[str, str] = {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
    }
    if extra:
        headers.update(extra)
    if api_key:
        headers["x-api-key"] = api_key
    return headers


def build_input_payload(
    message: str,
    user_id: Optional[str],
    session_id: Optional[str],
    metadata: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"message": message}
    if user_id is not None:
        payload["userId"] = user_id
    if session_id is not None:
        payload["sessionId"] = session_id
    if metadata:
        payload["metadata"] = metadata
    return payload


def build_output_payload(
    ai_response: str,
    session_id: Optional[str],
    metadata: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"aiResponse": ai_response}
    if session_id is not None:
        payload["sessionId"] = session_id
    if metadata:
        payload["metadata"] = metadata
    return payload


def build_analyze_payload(text: str, direction: str) -> Dict[str, Any]:
    return {"text": text, "direction": direction}


def should_call_llm(result: GuardResult) -> bool:
    """True only when the verdict permits an LLM call."""
    return bool(result.allowed) and result.action in LLM_SAFE_ACTIONS


def safe_text_or(result: GuardResult, original: str) -> str:
    """Prefer the guard's safe/redacted text, else the original."""
    return result.safe_text or result.redacted_text or original


def coerce_rag_source(item: Any) -> RagSource:
    """Accept RagSource, dict, or plain string from a retriever."""
    if isinstance(item, RagSource):
        return item
    if isinstance(item, str):
        return RagSource(text=item)
    if isinstance(item, dict):
        return RagSource(
            text=str(item.get("text", "")),
            id=item.get("id"),
            metadata=item.get("metadata"),
            citation=item.get("citation"),
        )
    # Best effort for arbitrary objects with a ``text`` attribute.
    return RagSource(text=str(getattr(item, "text", item)))


def partition_sources(
    sources: Iterable[Any],
    analyze_result_for: "callable",
) -> Tuple[List[SafeRagSource], List[ExcludedRagSource], int]:
    """Split retrieved sources into used (safe) and excluded (risky).

    ``analyze_result_for`` is a callable taking the source text and returning a
    :class:`GuardResult`; the caller supplies the sync or async-aware version.
    This sync helper is only used by the sync client.
    """
    used: List[SafeRagSource] = []
    excluded: List[ExcludedRagSource] = []
    count = 0
    for raw in sources:
        count += 1
        source = coerce_rag_source(raw)
        guard = analyze_result_for(source.text)
        if should_call_llm(guard):
            used.append(
                SafeRagSource(
                    text=source.text,
                    safe_text=safe_text_or(guard, source.text),
                    guard=guard,
                    id=source.id,
                    metadata=source.metadata,
                    citation=source.citation,
                )
            )
        else:
            excluded.append(ExcludedRagSource(source=source, guard=guard))
    return used, excluded, count


def join_context(used: List[SafeRagSource]) -> str:
    return "\n\n".join(s.safe_text for s in used)


def accepts_two_positional(func: Callable[..., Any]) -> bool:
    """Best-effort check: does ``func`` accept a second positional argument?

    Used to decide whether a chat ``call_llm`` callback wants just the safe
    message, or ``(safe_message, context)``. Falls back to ``False`` (one-arg)
    when the signature cannot be inspected (e.g. some C builtins).
    """
    try:
        sig = inspect.signature(func)
    except (TypeError, ValueError):
        return False
    positional = 0
    for param in sig.parameters.values():
        if param.kind == inspect.Parameter.VAR_POSITIONAL:
            return True
        if param.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD):
            positional += 1
    return positional >= 2


__all__ = [
    "DEFAULT_BASE_URL",
    "DEFAULT_TIMEOUT",
    "DEFAULT_BLOCKED_RESPONSE",
    "DEFAULT_OUTPUT_BLOCKED_RESPONSE",
    "USER_AGENT",
    "resolve_config",
    "redact_key",
    "base_headers",
    "build_input_payload",
    "build_output_payload",
    "build_analyze_payload",
    "should_call_llm",
    "safe_text_or",
    "coerce_rag_source",
    "partition_sources",
    "join_context",
    "accepts_two_positional",
]
