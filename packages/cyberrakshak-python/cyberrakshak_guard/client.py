"""Synchronous client for the CyberRakshak Guard API.

The client uses the Python standard library (``urllib``) by default so it has no
hard third-party dependency. Pass a custom ``transport`` callable to use
``requests`` or ``httpx`` instead.

Security:
- The API key is read from the environment by the caller and sent only in the
  ``x-api-key`` header. It is never logged.
- Raw prompt text is never logged. ``debug=True`` only emits safe diagnostics.
"""
from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, Optional

from .errors import (
    CyberRakshakAuthError,
    CyberRakshakConfigError,
    CyberRakshakError,
    CyberRakshakNetworkError,
    CyberRakshakRateLimitError,
    CyberRakshakValidationError,
)
from .types import GuardResult

DEFAULT_BASE_URL = "https://api.cyberrakshak.dev"
DEFAULT_TIMEOUT = 8.0
DEFAULT_BLOCKED_RESPONSE = "This request was blocked for security reasons."

logger = logging.getLogger("cyberrakshak")

# A transport receives (url, headers, body_bytes, timeout) and returns
# (status_code, headers_dict, body_text).
Transport = Callable[[str, Dict[str, str], bytes, float], "tuple[int, Dict[str, str], str]"]


class CyberRakshakClient:
    def __init__(
        self,
        api_key: str,
        *,
        base_url: Optional[str] = None,
        project_id: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
        retries: int = 0,
        debug: bool = False,
        transport: Optional[Transport] = None,
    ) -> None:
        if not api_key:
            raise CyberRakshakConfigError("api_key is required.")
        self.api_key = api_key
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        self.project_id = project_id
        self.timeout = timeout
        self.retries = max(0, retries)
        self.debug = debug
        self._transport = transport or _urllib_transport

    # ----- public API -------------------------------------------------------

    def guard_input(
        self,
        text: str,
        *,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> GuardResult:
        if not text or not text.strip():
            raise CyberRakshakValidationError("guard_input requires non-empty text.", status=400)
        payload: Dict[str, Any] = {"message": text}
        if user_id is not None:
            payload["userId"] = user_id
        if session_id is not None:
            payload["sessionId"] = session_id
        payload["metadata"] = self._with_project_metadata(metadata)
        return self._post("/api/guard/input", payload, require_api_key=True)

    def guard_output(
        self,
        text: str,
        *,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> GuardResult:
        if not text or not text.strip():
            raise CyberRakshakValidationError("guard_output requires non-empty text.", status=400)
        payload: Dict[str, Any] = {"aiResponse": text}
        if session_id is not None:
            payload["sessionId"] = session_id
        payload["metadata"] = self._with_project_metadata(metadata)
        return self._post("/api/guard/output", payload, require_api_key=True)

    def analyze(
        self,
        text: str,
        *,
        direction: str = "INPUT",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> GuardResult:
        if direction not in ("INPUT", "OUTPUT"):
            raise CyberRakshakValidationError("direction must be 'INPUT' or 'OUTPUT'.", status=400)
        payload = {"text": text, "direction": direction}
        return self._post("/api/guard/analyze", payload, require_api_key=False)

    def guard_conversation(
        self,
        input_text: str,
        call_llm: Callable[[str], str],
        *,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        blocked_response: str = DEFAULT_BLOCKED_RESPONSE,
    ) -> Dict[str, Any]:
        """Run input guard -> LLM -> output guard. Returns a result dict."""
        input_result = self.guard_input(
            input_text, user_id=user_id, session_id=session_id, metadata=metadata
        )
        if self.should_block(input_result):
            return {
                "reply": input_result.safe_text or blocked_response,
                "blocked": True,
                "input_result": input_result,
                "output_result": None,
            }
        safe_input = self.get_safe_text(input_result, input_text) or input_text
        llm_reply = call_llm(safe_input)
        output_result = self.guard_output(llm_reply, session_id=session_id, metadata=metadata)
        if self.should_block(output_result):
            return {
                "reply": output_result.safe_text or blocked_response,
                "blocked": True,
                "input_result": input_result,
                "output_result": output_result,
            }
        return {
            "reply": self.get_safe_text(output_result, llm_reply) or llm_reply,
            "blocked": False,
            "input_result": input_result,
            "output_result": output_result,
        }

    # ----- helpers ----------------------------------------------------------

    @staticmethod
    def is_allowed(result: GuardResult) -> bool:
        return result.allowed and result.decision != "BLOCK"

    @staticmethod
    def should_block(result: GuardResult) -> bool:
        return (not result.allowed) or result.decision in ("BLOCK", "HUMAN_REVIEW")

    @staticmethod
    def get_safe_text(result: GuardResult, fallback: Optional[str] = None) -> Optional[str]:
        return result.safe_text or result.redacted_text or fallback

    # ----- internals --------------------------------------------------------

    def _with_project_metadata(self, metadata: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        data = dict(metadata or {})
        if self.project_id:
            data.setdefault("projectId", self.project_id)
        return data

    def _post(self, path: str, body: Dict[str, Any], *, require_api_key: bool) -> GuardResult:
        url = f"{self.base_url}{path}"
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "cyberrakshak-guard-python/0.1",
        }
        if require_api_key:
            headers["x-api-key"] = self.api_key
        payload = json.dumps(body).encode("utf-8")

        attempt = 0
        while True:
            try:
                status, resp_headers, text = self._transport(url, headers, payload, self.timeout)
            except CyberRakshakNetworkError:
                if attempt < self.retries:
                    attempt += 1
                    self._log(f"retrying {path} (attempt {attempt + 1}/{self.retries + 1})")
                    time.sleep(min(0.25 * (2 ** (attempt - 1)), 2.0))
                    continue
                raise

            if 500 <= status < 600 and attempt < self.retries:
                attempt += 1
                self._log(f"retrying {path} after {status} (attempt {attempt + 1})")
                time.sleep(min(0.25 * (2 ** (attempt - 1)), 2.0))
                continue
            return self._handle_response(path, status, resp_headers, text)

    def _handle_response(
        self, path: str, status: int, headers: Dict[str, str], text: str
    ) -> GuardResult:
        data: Any = None
        if text:
            try:
                data = json.loads(text)
            except ValueError:
                raise CyberRakshakError("Server returned non-JSON response.", status=status)

        if status >= 400:
            message = _extract_message(data) or f"Request failed with status {status}."
            self._log(f"error {status} on {path}")
            if status in (401, 403):
                raise CyberRakshakAuthError(message, status=status)
            if status == 429:
                retry_after = _to_int(headers.get("Retry-After") or headers.get("retry-after"))
                raise CyberRakshakRateLimitError(message, status=status, retry_after=retry_after)
            if status == 400:
                raise CyberRakshakValidationError(message, status=status, details=data)
            raise CyberRakshakError(message, status=status, details=data)

        if not isinstance(data, dict):
            raise CyberRakshakError("Unexpected response shape.", status=status)
        return GuardResult.from_dict(data)

    def _log(self, message: str) -> None:
        if self.debug:
            # Never logs the API key or raw text.
            logger.debug("[cyberrakshak] %s", message)


def _urllib_transport(
    url: str, headers: Dict[str, str], body: bytes, timeout: float
) -> "tuple[int, Dict[str, str], str]":
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 (trusted base_url)
            text = response.read().decode("utf-8")
            return response.status, dict(response.headers), text
    except urllib.error.HTTPError as exc:  # non-2xx still carries a body
        text = exc.read().decode("utf-8") if exc.fp else ""
        return exc.code, dict(exc.headers or {}), text
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise CyberRakshakNetworkError(f"Network request failed: {exc.__class__.__name__}") from exc


def _extract_message(data: Any) -> Optional[str]:
    if isinstance(data, dict):
        message = data.get("message")
        if isinstance(message, str):
            return message
    return None


def _to_int(value: Any) -> Optional[int]:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None
