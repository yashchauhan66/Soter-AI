"""Flask helper for CyberRakshak Guard.

``create_chat_view`` returns a Flask view function that reads JSON, runs
``guard.protect_chat`` around your LLM call, and returns the guarded result.

Example::

    from flask import Flask
    from cyberrakshak_guard import CyberRakshakGuard
    from cyberrakshak_guard.flask import create_chat_view

    app = Flask(__name__)
    guard = CyberRakshakGuard()
    app.add_url_rule("/chat", view_func=create_chat_view(guard, lambda s: my_llm(s)), methods=["POST"])
"""

from __future__ import annotations

from typing import Any, Callable


def create_chat_view(
    guard: Any,
    call_llm: Callable[..., str],
    *,
    message_field: str = "message",
    user_id_field: str = "userId",
    session_id_field: str = "sessionId",
) -> Callable[[], Any]:
    """Build a Flask view that guards a chat turn and returns JSON."""

    def view() -> Any:
        from flask import jsonify, request

        data = request.get_json(silent=True) or {}
        message = data.get(message_field, "")
        if not isinstance(message, str) or not message.strip():
            return jsonify({"error": True, "message": "message is required."}), 400
        result = guard.protect_chat(
            message=message,
            call_llm=call_llm,
            user_id=data.get(user_id_field),
            session_id=data.get(session_id_field),
        )
        return jsonify(result.to_dict())

    return view


__all__ = ["create_chat_view"]
