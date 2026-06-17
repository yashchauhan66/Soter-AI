"""LangChain wrapper for CyberRakshak Guard.

``protect_langchain_chain`` wraps any object with an ``.invoke(input)`` method
(an LCEL Runnable, an LLMChain, etc.) so that:

1. The user message is guarded before the chain runs.
2. A blocked/human-review verdict short-circuits without invoking the chain.
3. Safe/redacted text is what the chain actually sees.
4. The chain's textual output is guarded before being returned.

It is duck-typed and does not import langchain, so it works with any version
(and in tests without langchain installed).

Example::

    from cyberrakshak_guard import CyberRakshakGuard
    from cyberrakshak_guard.langchain import protect_langchain_chain

    guard = CyberRakshakGuard()
    safe_chain = protect_langchain_chain(my_chain, guard)
    result = safe_chain.invoke({"input": user_message})
    print(result["safe_response"], result["blocked"])
"""

from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from .utils import DEFAULT_BLOCKED_RESPONSE, DEFAULT_OUTPUT_BLOCKED_RESPONSE


def _extract_text(value: Any) -> str:
    """Pull a string out of common LangChain return shapes."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    # AIMessage / ChatGeneration-like objects expose ``.content``.
    content = getattr(value, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(value, dict):
        for key in ("output", "text", "answer", "result", "content"):
            if isinstance(value.get(key), str):
                return value[key]
    return str(value)


class _ProtectedChain:
    """Minimal Runnable-like wrapper exposing ``invoke``."""

    def __init__(
        self,
        chain: Any,
        guard: Any,
        input_key: str,
        blocked_response: str,
        output_blocked_response: str,
        user_id: Optional[str],
        session_id: Optional[str],
    ) -> None:
        self._chain = chain
        self._guard = guard
        self._input_key = input_key
        self._blocked_response = blocked_response
        self._output_blocked_response = output_blocked_response
        self._user_id = user_id
        self._session_id = session_id

    def _coerce_message(self, chain_input: Any) -> str:
        if isinstance(chain_input, str):
            return chain_input
        if isinstance(chain_input, dict):
            value = chain_input.get(self._input_key)
            if isinstance(value, str):
                return value
            # Fall back to the first string value present.
            for candidate in chain_input.values():
                if isinstance(candidate, str):
                    return candidate
        return str(chain_input)

    def invoke(self, chain_input: Any, config: Any = None, **kwargs: Any) -> Dict[str, Any]:
        message = self._coerce_message(chain_input)
        input_guard = self._guard.input(
            message, user_id=self._user_id, session_id=self._session_id
        )
        if not self._guard.should_call_llm(input_guard):
            return {
                "blocked": True,
                "llm_called": False,
                "input_action": input_guard.action,
                "safe_response": input_guard.safe_text or self._blocked_response,
                "input_guard": input_guard,
            }

        safe_message = self._guard.get_safe_input(input_guard, message)
        safe_input = (
            {**chain_input, self._input_key: safe_message}
            if isinstance(chain_input, dict)
            else safe_message
        )
        raw = self._chain.invoke(safe_input, config) if config is not None else self._chain.invoke(safe_input)
        raw_text = _extract_text(raw)

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
        }

    # Make the wrapper itself callable like a Runnable.
    __call__ = invoke


def protect_langchain_chain(
    chain: Any,
    guard: Any,
    *,
    input_key: str = "input",
    blocked_response: str = DEFAULT_BLOCKED_RESPONSE,
    output_blocked_response: str = DEFAULT_OUTPUT_BLOCKED_RESPONSE,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> _ProtectedChain:
    """Wrap a LangChain chain/runnable with input + output guarding."""
    return _ProtectedChain(
        chain=chain,
        guard=guard,
        input_key=input_key,
        blocked_response=blocked_response,
        output_blocked_response=output_blocked_response,
        user_id=user_id,
        session_id=session_id,
    )


__all__ = ["protect_langchain_chain"]
