"""Synchronous CyberRakshak Guard client (built on :mod:`requests`)."""

from __future__ import annotations

import time
from typing import Any, Callable, Dict, Iterable, List, Optional

import requests

from .exceptions import (
    CyberRakshakAuthError,
    CyberRakshakError,
    CyberRakshakNetworkError,
    CyberRakshakRateLimitError,
    CyberRakshakValidationError,
)
from .types import (
    ExcludedRagSource,
    GuardResult,
    ProtectChatResult,
    ProtectRagResult,
    SafeRagSource,
)
from .utils import (
    DEFAULT_BLOCKED_RESPONSE,
    DEFAULT_OUTPUT_BLOCKED_RESPONSE,
    accepts_two_positional,
    base_headers,
    build_analyze_payload,
    build_input_payload,
    build_output_payload,
    coerce_rag_source,
    join_context,
    resolve_config,
    safe_text_or,
    should_call_llm,
)

ChatLLM = Callable[..., str]
RetrieveFn = Callable[[str], Iterable[Any]]
RagLLM = Callable[[Dict[str, Any]], str]


class CyberRakshakGuard:
    """Synchronous guard client.

    Usage (env-based, the easiest path)::

        from cyberrakshak_guard import CyberRakshakGuard
        guard = CyberRakshakGuard()  # reads CYBERRAKSHAK_API_KEY / _BASE_URL

    or explicit::

        guard = CyberRakshakGuard(api_key="ck_...", base_url="http://localhost:3000")
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        *,
        max_retries: int = 0,
        retry_backoff: float = 0.25,
        headers: Optional[Dict[str, str]] = None,
        session: Optional["requests.Session"] = None,
    ) -> None:
        self.api_key, self.base_url, self.timeout = resolve_config(api_key, base_url, timeout)
        self.max_retries = max(0, int(max_retries))
        self.retry_backoff = retry_backoff
        self._extra_headers = dict(headers or {})
        self._session = session or requests.Session()

    # ------------------------------------------------------------------
    # Core guard calls
    # ------------------------------------------------------------------
    def input(
        self,
        message: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> GuardResult:
        payload = build_input_payload(message, user_id, session_id, metadata)
        return self._post("/api/guard/input", payload, auth=True)

    def output(
        self,
        ai_response: str,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> GuardResult:
        payload = build_output_payload(ai_response, session_id, metadata)
        return self._post("/api/guard/output", payload, auth=True)

    def analyze(
        self,
        text: str,
        direction: str = "INPUT",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> GuardResult:
        payload = build_analyze_payload(text, direction)
        if metadata:
            payload["metadata"] = metadata
        return self._post("/api/guard/analyze", payload, auth=False)

    # ------------------------------------------------------------------
    # Decision helpers
    # ------------------------------------------------------------------
    def should_call_llm(self, result: GuardResult) -> bool:
        return should_call_llm(result)

    def get_safe_input(self, result: GuardResult, original_message: str) -> str:
        return safe_text_or(result, original_message)

    def get_safe_output(self, result: GuardResult, original_output: str) -> str:
        return safe_text_or(result, original_output)

    # ------------------------------------------------------------------
    # protect_chat
    # ------------------------------------------------------------------
    def protect_chat(
        self,
        message: str,
        call_llm: ChatLLM,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        *,
        blocked_response: str = DEFAULT_BLOCKED_RESPONSE,
        output_blocked_response: str = DEFAULT_OUTPUT_BLOCKED_RESPONSE,
    ) -> ProtectChatResult:
        started = time.monotonic()
        input_guard = self.input(message, user_id=user_id, session_id=session_id, metadata=metadata)

        if not should_call_llm(input_guard):
            return ProtectChatResult(
                allowed=False,
                blocked=True,
                input_action=input_guard.action,
                llm_called=False,
                safe_response=input_guard.safe_text or blocked_response,
                input_guard=input_guard,
                latency_ms=_elapsed_ms(started),
            )

        safe_message = safe_text_or(input_guard, message)
        raw_output = _invoke_chat_llm(call_llm, safe_message, message, input_guard)
        output_guard = self.output(raw_output, session_id=session_id, metadata=metadata)
        output_allowed = should_call_llm(output_guard)
        return ProtectChatResult(
            allowed=output_allowed,
            blocked=not output_allowed,
            input_action=input_guard.action,
            output_action=output_guard.action,
            llm_called=True,
            safe_response=(
                safe_text_or(output_guard, raw_output)
                if output_allowed
                else (output_guard.safe_text or output_guard.redacted_text or output_blocked_response)
            ),
            input_guard=input_guard,
            output_guard=output_guard,
            latency_ms=_elapsed_ms(started),
        )

    # ------------------------------------------------------------------
    # protect_rag
    # ------------------------------------------------------------------
    def protect_rag(
        self,
        query: str,
        retrieve: RetrieveFn,
        call_llm: RagLLM,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        *,
        blocked_response: str = DEFAULT_BLOCKED_RESPONSE,
        output_blocked_response: str = DEFAULT_OUTPUT_BLOCKED_RESPONSE,
    ) -> ProtectRagResult:
        started = time.monotonic()
        input_guard = self.input(query, user_id=user_id, session_id=session_id, metadata=metadata)
        if not should_call_llm(input_guard):
            return ProtectRagResult(
                allowed=False,
                blocked=True,
                input_action=input_guard.action,
                llm_called=False,
                retrieved=0,
                used_sources=[],
                excluded_sources=[],
                safe_response=input_guard.safe_text or blocked_response,
                input_guard=input_guard,
                latency_ms=_elapsed_ms(started),
            )

        safe_query = safe_text_or(input_guard, query)
        used: List[SafeRagSource] = []
        excluded: List[ExcludedRagSource] = []
        retrieved = 0
        for raw in retrieve(safe_query):
            retrieved += 1
            source = coerce_rag_source(raw)
            guard = self.analyze(source.text, "INPUT")
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

        raw_output = call_llm(
            {
                "safeQuery": safe_query,
                "safeContext": join_context(used),
                "sources": used,
            }
        )
        output_guard = self.output(raw_output, session_id=session_id, metadata=metadata)
        output_allowed = should_call_llm(output_guard)
        return ProtectRagResult(
            allowed=output_allowed,
            blocked=not output_allowed,
            input_action=input_guard.action,
            output_action=output_guard.action,
            llm_called=True,
            retrieved=retrieved,
            used_sources=used,
            excluded_sources=excluded,
            safe_response=(
                safe_text_or(output_guard, raw_output)
                if output_allowed
                else (output_guard.safe_text or output_guard.redacted_text or output_blocked_response)
            ),
            input_guard=input_guard,
            output_guard=output_guard,
            latency_ms=_elapsed_ms(started),
        )

    # ------------------------------------------------------------------
    # Transport
    # ------------------------------------------------------------------
    def _post(self, path: str, payload: Dict[str, Any], auth: bool) -> GuardResult:
        url = f"{self.base_url}{path}"
        headers = base_headers(self.api_key if auth else None, self._extra_headers)
        attempt = 0
        while True:
            try:
                response = self._session.post(url, json=payload, headers=headers, timeout=self.timeout)
                break
            except requests.RequestException as exc:
                if attempt >= self.max_retries:
                    raise CyberRakshakNetworkError(
                        f"Network request to {path} failed: {exc}", cause=exc
                    ) from exc
                attempt += 1
                time.sleep(self.retry_backoff * attempt)

        return _parse_response(response.status_code, response.text, dict(response.headers))


def _elapsed_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)


def _invoke_chat_llm(call_llm: ChatLLM, safe_message: str, original: str, input_guard: GuardResult) -> str:
    """Call the user LLM callback, supporting both 1-arg and 2-arg signatures."""
    if accepts_two_positional(call_llm):
        return call_llm(safe_message, {"originalMessage": original, "inputGuard": input_guard})
    return call_llm(safe_message)


def _parse_response(status: int, text: str, headers: Dict[str, str]) -> GuardResult:
    import json

    data: Any = None
    if text:
        try:
            data = json.loads(text)
        except ValueError as exc:
            raise CyberRakshakError(
                "Server returned a non-JSON response.", status=status
            ) from exc

    if status >= 400:
        message = (
            data.get("message")
            if isinstance(data, dict) and isinstance(data.get("message"), str)
            else f"Request failed with status {status}."
        )
        if status in (401, 403):
            raise CyberRakshakAuthError(message, status, details=data)
        if status == 429:
            retry_after = headers.get("Retry-After") or headers.get("retry-after")
            raise CyberRakshakRateLimitError(
                message, status, retry_after=int(retry_after) if retry_after else None, details=data
            )
        if status == 400:
            raise CyberRakshakValidationError(message, status, details=data)
        raise CyberRakshakError(message, status=status, details=data)

    if not isinstance(data, dict):
        raise CyberRakshakError("Server returned an unexpected response shape.", status=status)
    return GuardResult.from_dict(data)


__all__ = ["CyberRakshakGuard"]
