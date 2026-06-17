"""Asynchronous CyberRakshak Guard client (built on :mod:`httpx`).

Mirrors :class:`cyberrakshak_guard.client.CyberRakshakGuard` exactly, but every
network method is a coroutine. ``call_llm`` / ``retrieve`` callbacks may be
either sync or async; both are awaited correctly.
"""

from __future__ import annotations

import asyncio
import inspect
import time
from typing import Any, Awaitable, Callable, Dict, Iterable, List, Optional, Union

try:
    import httpx
except ImportError as exc:  # pragma: no cover - exercised only without httpx
    raise ImportError(
        "AsyncCyberRakshakGuard requires httpx. Install it with "
        "`pip install \"cyberrakshak-guard[async]\"` or `pip install httpx`."
    ) from exc

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

AsyncChatLLM = Callable[..., Union[str, Awaitable[str]]]
AsyncRetrieveFn = Callable[[str], Union[Iterable[Any], Awaitable[Iterable[Any]]]]
AsyncRagLLM = Callable[[Dict[str, Any]], Union[str, Awaitable[str]]]


class AsyncCyberRakshakGuard:
    """Asynchronous guard client. See :class:`CyberRakshakGuard` for semantics."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        *,
        max_retries: int = 0,
        retry_backoff: float = 0.25,
        headers: Optional[Dict[str, str]] = None,
        client: Optional["httpx.AsyncClient"] = None,
    ) -> None:
        self.api_key, self.base_url, self.timeout = resolve_config(api_key, base_url, timeout)
        self.max_retries = max(0, int(max_retries))
        self.retry_backoff = retry_backoff
        self._extra_headers = dict(headers or {})
        self._client = client
        self._owns_client = client is None

    async def __aenter__(self) -> "AsyncCyberRakshakGuard":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._owns_client and self._client is not None:
            await self._client.aclose()
            self._client = None

    def _get_client(self) -> "httpx.AsyncClient":
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    # ------------------------------------------------------------------
    # Core guard calls
    # ------------------------------------------------------------------
    async def input(
        self,
        message: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> GuardResult:
        payload = build_input_payload(message, user_id, session_id, metadata)
        return await self._post("/api/guard/input", payload, auth=True)

    async def output(
        self,
        ai_response: str,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> GuardResult:
        payload = build_output_payload(ai_response, session_id, metadata)
        return await self._post("/api/guard/output", payload, auth=True)

    async def analyze(
        self,
        text: str,
        direction: str = "INPUT",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> GuardResult:
        payload = build_analyze_payload(text, direction)
        if metadata:
            payload["metadata"] = metadata
        return await self._post("/api/guard/analyze", payload, auth=False)

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
    async def protect_chat(
        self,
        message: str,
        call_llm: AsyncChatLLM,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        *,
        blocked_response: str = DEFAULT_BLOCKED_RESPONSE,
        output_blocked_response: str = DEFAULT_OUTPUT_BLOCKED_RESPONSE,
    ) -> ProtectChatResult:
        started = time.monotonic()
        input_guard = await self.input(message, user_id=user_id, session_id=session_id, metadata=metadata)

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
        raw_output = await _invoke_chat_llm(call_llm, safe_message, message, input_guard)
        output_guard = await self.output(raw_output, session_id=session_id, metadata=metadata)
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
    async def protect_rag(
        self,
        query: str,
        retrieve: AsyncRetrieveFn,
        call_llm: AsyncRagLLM,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        *,
        blocked_response: str = DEFAULT_BLOCKED_RESPONSE,
        output_blocked_response: str = DEFAULT_OUTPUT_BLOCKED_RESPONSE,
    ) -> ProtectRagResult:
        started = time.monotonic()
        input_guard = await self.input(query, user_id=user_id, session_id=session_id, metadata=metadata)
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
        sources = await _maybe_await(retrieve(safe_query))
        used: List[SafeRagSource] = []
        excluded: List[ExcludedRagSource] = []
        retrieved = 0
        for raw in sources:
            retrieved += 1
            source = coerce_rag_source(raw)
            guard = await self.analyze(source.text, "INPUT")
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

        raw_output = await _maybe_await(
            call_llm({"safeQuery": safe_query, "safeContext": join_context(used), "sources": used})
        )
        output_guard = await self.output(raw_output, session_id=session_id, metadata=metadata)
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
    async def _post(self, path: str, payload: Dict[str, Any], auth: bool) -> GuardResult:
        url = f"{self.base_url}{path}"
        headers = base_headers(self.api_key if auth else None, self._extra_headers)
        client = self._get_client()
        attempt = 0
        while True:
            try:
                response = await client.post(url, json=payload, headers=headers, timeout=self.timeout)
                break
            except httpx.HTTPError as exc:
                if attempt >= self.max_retries:
                    raise CyberRakshakNetworkError(
                        f"Network request to {path} failed: {exc}", cause=exc
                    ) from exc
                attempt += 1
                await asyncio.sleep(self.retry_backoff * attempt)

        return _parse_response(response.status_code, response.text, dict(response.headers))


def _elapsed_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)


async def _maybe_await(value: Any) -> Any:
    if inspect.isawaitable(value):
        return await value
    return value


async def _invoke_chat_llm(call_llm: AsyncChatLLM, safe_message: str, original: str, input_guard: GuardResult) -> str:
    if accepts_two_positional(call_llm):
        result = call_llm(safe_message, {"originalMessage": original, "inputGuard": input_guard})
    else:
        result = call_llm(safe_message)
    return await _maybe_await(result)


def _parse_response(status: int, text: str, headers: Dict[str, str]) -> GuardResult:
    import json

    data: Any = None
    if text:
        try:
            data = json.loads(text)
        except ValueError as exc:
            raise CyberRakshakError("Server returned a non-JSON response.", status=status) from exc

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


__all__ = ["AsyncCyberRakshakGuard"]
