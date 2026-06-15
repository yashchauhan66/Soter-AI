"""FastAPI helpers for CyberRakshak Guard.

These are optional; importing this module does not require FastAPI to be
installed unless you actually call the helpers, which create dependencies.
"""
from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from .client import CyberRakshakClient
from .types import GuardResult


def create_guard_dependency(
    client: CyberRakshakClient,
    *,
    field: str = "message",
    blocked_response: str = "This request was blocked for security reasons.",
) -> Callable[..., Any]:
    """Return a FastAPI dependency that guards an incoming request body.

    The dependency reads ``field`` from the JSON body, runs the input guard, and
    raises ``HTTPException(200-style block)`` semantics by returning a sentinel
    when blocked. To keep this importable without FastAPI installed, the
    import is deferred to call time.
    """
    try:
        from fastapi import HTTPException, Request  # noqa: F401
    except ImportError as exc:  # pragma: no cover - only triggered without fastapi
        raise RuntimeError("FastAPI is required for create_guard_dependency().") from exc

    async def dependency(request: "Request") -> Dict[str, Any]:
        body = await request.json()
        text = body.get(field) if isinstance(body, dict) else None
        if not isinstance(text, str) or not text.strip():
            from fastapi import HTTPException

            raise HTTPException(status_code=400, detail=f"{field} is required.")
        result = client.guard_input(text)
        return {
            "blocked": client.should_block(result),
            "result": result,
            "safe_text": client.get_safe_text(result, text),
            "blocked_response": blocked_response,
        }

    return dependency


def guard_input_dependency(client: CyberRakshakClient, field: str = "message") -> Callable[..., Any]:
    """Alias of :func:`create_guard_dependency` with default block response."""
    return create_guard_dependency(client, field=field)


def guard_output_response(
    client: CyberRakshakClient,
    ai_response: str,
    *,
    blocked_response: str = "The response was withheld for safety.",
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Guard an outgoing AI response and return a JSON-serializable dict."""
    result: GuardResult = client.guard_output(ai_response, session_id=session_id)
    if client.should_block(result):
        return {"blocked": True, "reply": result.safe_text or blocked_response}
    return {"blocked": False, "reply": client.get_safe_text(result, ai_response) or ai_response}
