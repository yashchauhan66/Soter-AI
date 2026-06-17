"""LlamaIndex wrapper for CyberRakshak Guard.

``protect_query_engine`` wraps any object exposing ``.query(str)`` (a
LlamaIndex query engine) so the user query is guarded before retrieval and the
final answer is guarded before being returned. Optionally inspects retrieved
source nodes and drops risky ones from the returned sources.

Duck-typed; does not import llama_index, so it works with any version.

Example::

    from cyberrakshak_guard import CyberRakshakGuard
    from cyberrakshak_guard.llamaindex import protect_query_engine

    guard = CyberRakshakGuard()
    safe_engine = protect_query_engine(query_engine, guard)
    response = safe_engine.query("How do I reset my password?")
    print(response["safe_response"], response["blocked"])
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .utils import DEFAULT_BLOCKED_RESPONSE, DEFAULT_OUTPUT_BLOCKED_RESPONSE


def _response_text(response: Any) -> str:
    if response is None:
        return ""
    if isinstance(response, str):
        return response
    text = getattr(response, "response", None)
    if isinstance(text, str):
        return text
    return str(response)


def _source_nodes(response: Any) -> List[Any]:
    nodes = getattr(response, "source_nodes", None)
    return list(nodes) if nodes else []


def _node_text(node: Any) -> str:
    getter = getattr(node, "get_content", None)
    if callable(getter):
        try:
            return str(getter())
        except Exception:  # pragma: no cover - defensive
            pass
    for attr in ("text", "content"):
        value = getattr(node, attr, None)
        if isinstance(value, str):
            return value
    inner = getattr(node, "node", None)
    if inner is not None and inner is not node:
        return _node_text(inner)
    return str(node)


class _ProtectedQueryEngine:
    def __init__(
        self,
        query_engine: Any,
        guard: Any,
        check_sources: bool,
        blocked_response: str,
        output_blocked_response: str,
        user_id: Optional[str],
        session_id: Optional[str],
    ) -> None:
        self._engine = query_engine
        self._guard = guard
        self._check_sources = check_sources
        self._blocked_response = blocked_response
        self._output_blocked_response = output_blocked_response
        self._user_id = user_id
        self._session_id = session_id

    def query(self, query_str: str) -> Dict[str, Any]:
        input_guard = self._guard.input(
            query_str, user_id=self._user_id, session_id=self._session_id
        )
        if not self._guard.should_call_llm(input_guard):
            return {
                "blocked": True,
                "llm_called": False,
                "input_action": input_guard.action,
                "safe_response": input_guard.safe_text or self._blocked_response,
                "input_guard": input_guard,
                "used_sources": [],
                "excluded_sources": [],
            }

        safe_query = self._guard.get_safe_input(input_guard, query_str)
        response = self._engine.query(safe_query)
        raw_text = _response_text(response)

        used_sources: List[Any] = []
        excluded_sources: List[Any] = []
        if self._check_sources:
            for node in _source_nodes(response):
                verdict = self._guard.analyze(_node_text(node), "INPUT")
                if self._guard.should_call_llm(verdict):
                    used_sources.append(node)
                else:
                    excluded_sources.append(node)
        else:
            used_sources = _source_nodes(response)

        output_guard = self._guard.output(raw_text, session_id=self._session_id)
        allowed = self._guard.should_call_llm(output_guard)
        return {
            "blocked": not allowed,
            "llm_called": True,
            "input_action": input_guard.action,
            "output_action": output_guard.action,
            "safe_response": (
                self._guard.get_safe_output(output_guard, raw_text)
                if allowed
                else (output_guard.safe_text or output_guard.redacted_text or self._output_blocked_response)
            ),
            "input_guard": input_guard,
            "output_guard": output_guard,
            "used_sources": used_sources,
            "excluded_sources": excluded_sources,
        }


def protect_query_engine(
    query_engine: Any,
    guard: Any,
    *,
    check_sources: bool = False,
    blocked_response: str = DEFAULT_BLOCKED_RESPONSE,
    output_blocked_response: str = DEFAULT_OUTPUT_BLOCKED_RESPONSE,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> _ProtectedQueryEngine:
    """Wrap a LlamaIndex query engine with input + output guarding."""
    return _ProtectedQueryEngine(
        query_engine=query_engine,
        guard=guard,
        check_sources=check_sources,
        blocked_response=blocked_response,
        output_blocked_response=output_blocked_response,
        user_id=user_id,
        session_id=session_id,
    )


__all__ = ["protect_query_engine"]
