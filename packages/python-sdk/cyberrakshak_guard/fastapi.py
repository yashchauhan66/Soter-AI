"""FastAPI helper for CyberRakshak Guard.

Provides ``create_chat_route`` which returns a ready-to-mount handler that runs
``guard.protect_chat`` around your LLM call. Works with the sync client (the
handler is sync) or the async client (the handler is async).

Example::

    from fastapi import FastAPI
    from cyberrakshak_guard import CyberRakshakGuard
    from cyberrakshak_guard.fastapi import create_chat_route

    app = FastAPI()
    guard = CyberRakshakGuard()

    app.add_api_route(
        "/chat",
        create_chat_route(guard, call_llm=lambda safe: my_llm(safe)),
        methods=["POST"],
    )
"""

from __future__ import annotations

import inspect
from typing import Any, Awaitable, Callable, Dict, Optional, Union

ChatLLM = Callable[..., Union[str, Awaitable[str]]]


def create_chat_route(
    guard: Any,
    call_llm: ChatLLM,
    *,
    message_field: str = "message",
    user_id_field: str = "userId",
    session_id_field: str = "sessionId",
) -> Callable[[Dict[str, Any]], Any]:
    """Build a FastAPI route handler that guards a chat turn.

    ``guard`` may be a sync ``CyberRakshakGuard`` or an
    ``AsyncCyberRakshakGuard``; the returned handler matches.
    """
    is_async = inspect.iscoroutinefunction(getattr(guard, "protect_chat", None))

    if is_async:
        async def async_handler(payload: Dict[str, Any]) -> Dict[str, Any]:
            result = await guard.protect_chat(
                message=payload.get(message_field, ""),
                call_llm=call_llm,
                user_id=payload.get(user_id_field),
                session_id=payload.get(session_id_field),
            )
            return result.to_dict()

        return async_handler

    def handler(payload: Dict[str, Any]) -> Dict[str, Any]:
        result = guard.protect_chat(
            message=payload.get(message_field, ""),
            call_llm=call_llm,
            user_id=payload.get(user_id_field),
            session_id=payload.get(session_id_field),
        )
        return result.to_dict()

    return handler


__all__ = ["create_chat_route"]
