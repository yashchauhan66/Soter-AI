"""LangChain helpers for CyberRakshak Guard.

These wrappers add input/output guarding around any LangChain-style LLM or
chain. They avoid a hard dependency on LangChain: the callback handler only
subclasses ``BaseCallbackHandler`` when LangChain is installed.
"""
from __future__ import annotations

from typing import Any, Callable, Optional

from .client import CyberRakshakClient

GuardBlocked = type("GuardBlocked", (Exception,), {})


def guard_langchain_input(
    client: CyberRakshakClient,
    text: str,
    *,
    blocked_response: str = "This request was blocked for security reasons.",
) -> str:
    """Guard a prompt before it reaches the model. Returns safe text or raises
    :class:`GuardBlocked` when the input must not proceed."""
    result = client.guard_input(text)
    if client.should_block(result):
        raise GuardBlocked(result.safe_text or blocked_response)
    return client.get_safe_text(result, text) or text


def guard_langchain_output(
    client: CyberRakshakClient,
    text: str,
    *,
    blocked_response: str = "The response was withheld for safety.",
) -> str:
    """Guard a model completion. Returns safe text, or the blocked response."""
    result = client.guard_output(text)
    if client.should_block(result):
        return result.safe_text or blocked_response
    return client.get_safe_text(result, text) or text


class GuardedLLMWrapper:
    """Wrap any callable/LLM with ``__call__(prompt) -> str`` semantics.

    The wrapper guards the prompt, calls the wrapped model with safe text, then
    guards the completion before returning it.
    """

    def __init__(
        self,
        llm: Callable[[str], str],
        client: CyberRakshakClient,
        *,
        blocked_response: str = "This request was blocked for security reasons.",
        withheld_response: str = "The response was withheld for safety.",
    ) -> None:
        self._llm = llm
        self._client = client
        self._blocked = blocked_response
        self._withheld = withheld_response

    def invoke(self, prompt: str) -> str:
        try:
            safe_input = guard_langchain_input(self._client, prompt, blocked_response=self._blocked)
        except GuardBlocked as blocked:
            return str(blocked)
        completion = self._llm(safe_input)
        return guard_langchain_output(self._client, completion, blocked_response=self._withheld)

    # Allow GuardedLLMWrapper(prompt) too.
    def __call__(self, prompt: str) -> str:
        return self.invoke(prompt)


def _resolve_base_callback() -> Any:
    try:
        from langchain_core.callbacks import BaseCallbackHandler  # type: ignore

        return BaseCallbackHandler
    except ImportError:
        try:
            from langchain.callbacks.base import BaseCallbackHandler  # type: ignore

            return BaseCallbackHandler
        except ImportError:
            return object


_Base = _resolve_base_callback()


class CyberRakshakCallbackHandler(_Base):  # type: ignore[misc, valid-type]
    """LangChain callback handler that monitors prompts and completions.

    This is an observability hook: it runs the public ``analyze`` endpoint (no
    blocking) and records findings via ``on_finding``. Use
    :class:`GuardedLLMWrapper` when you need to block. Raw prompts are not stored
    on the handler; only findings are exposed.
    """

    def __init__(self, client: CyberRakshakClient, on_finding: Optional[Callable[[Any], None]] = None) -> None:
        super().__init__()
        self._client = client
        self._on_finding = on_finding
        self.findings: list = []

    def _record(self, text: str, direction: str) -> None:
        try:
            result = self._client.analyze(text, direction=direction)
        except Exception:  # never break the chain on a monitoring failure
            return
        if result.risk_types and result.risk_types != ["LOW_RISK"]:
            self.findings.append(result)
            if self._on_finding:
                self._on_finding(result)

    def on_llm_start(self, serialized: Any, prompts: list, **kwargs: Any) -> None:  # noqa: D401
        for prompt in prompts or []:
            if isinstance(prompt, str):
                self._record(prompt, "INPUT")

    def on_llm_end(self, response: Any, **kwargs: Any) -> None:
        text = _extract_llm_text(response)
        if text:
            self._record(text, "OUTPUT")


def _extract_llm_text(response: Any) -> Optional[str]:
    # Best-effort extraction across LangChain LLMResult shapes.
    try:
        generations = getattr(response, "generations", None)
        if generations and generations[0]:
            first = generations[0][0]
            return getattr(first, "text", None) or str(first)
    except Exception:
        return None
    return None
