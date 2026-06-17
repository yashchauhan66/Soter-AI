"""Shared pytest fixtures and a mock transport for the CyberRakshak Guard SDK.

Tests never hit the network. We install a fake ``requests`` session (sync) and
patch ``httpx.AsyncClient`` (async) that record every request and return
canned guard verdicts driven by simple keyword matching on the text.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import pytest


# ---------------------------------------------------------------------------
# Canned verdict logic shared by sync + async mocks
# ---------------------------------------------------------------------------
def verdict_for(text: str, direction: str) -> Dict[str, Any]:
    """Return a GuardResult-shaped dict based on keywords in ``text``."""
    lowered = (text or "").lower()
    if "ignore previous instructions" in lowered or "reveal your system prompt" in lowered:
        return {
            "allowed": False,
            "action": "BLOCK",
            "riskScore": 92,
            "riskTypes": ["PROMPT_INJECTION", "SYSTEM_PROMPT_LEAK_ATTEMPT"],
            "reason": "High-risk prompt injection detected.",
            "findings": [
                {"type": "PROMPT_INJECTION", "label": "Prompt injection", "severity": "HIGH", "score": 92, "message": "blocked"}
            ],
        }
    if "needs review" in lowered:
        return {
            "allowed": False,
            "action": "HUMAN_REVIEW",
            "riskScore": 60,
            "riskTypes": ["LOW_RISK"],
            "reason": "Flagged for human review.",
            "findings": [],
        }
    if "my password is" in lowered or "sk-" in lowered or "secret" in lowered:
        return {
            "allowed": True,
            "action": "ALLOW_WITH_REDACTION",
            "riskScore": 40,
            "riskTypes": ["SECRET_DETECTED"],
            "reason": "Secret detected and redacted.",
            "redactedText": "[REDACTED]",
            "safeText": "[REDACTED]",
            "findings": [
                {"type": "SECRET_DETECTED", "label": "Secret", "severity": "MEDIUM", "score": 40, "message": "redacted"}
            ],
        }
    if "hidden system prompt" in lowered or "leak" in lowered:
        return {
            "allowed": False,
            "action": "BLOCK",
            "riskScore": 88,
            "riskTypes": ["SYSTEM_PROMPT_LEAKAGE"],
            "reason": "System prompt leakage detected.",
            "findings": [],
        }
    return {
        "allowed": True,
        "action": "ALLOW",
        "riskScore": 2,
        "riskTypes": ["LOW_RISK"],
        "reason": "No significant risk detected.",
        "findings": [],
    }


class RecordedRequest:
    def __init__(self, url: str, headers: Dict[str, str], body: Dict[str, Any]) -> None:
        self.url = url
        self.headers = headers
        self.body = body


# ---------------------------------------------------------------------------
# Sync mock: a fake requests.Session
# ---------------------------------------------------------------------------
class FakeResponse:
    def __init__(self, status_code: int, payload: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> None:
        self.status_code = status_code
        self._payload = payload
        self.headers = headers or {}

    @property
    def text(self) -> str:
        return json.dumps(self._payload)

    def json(self) -> Dict[str, Any]:
        return self._payload


class FakeSession:
    """Stands in for ``requests.Session``."""

    def __init__(self) -> None:
        self.requests: List[RecordedRequest] = []
        self.force_status: Optional[int] = None
        self.force_payload: Optional[Dict[str, Any]] = None
        self.force_headers: Dict[str, str] = {}

    def post(self, url: str, json: Dict[str, Any], headers: Dict[str, str], timeout: Any = None) -> FakeResponse:  # noqa: A002
        self.requests.append(RecordedRequest(url, dict(headers), dict(json)))
        if self.force_status is not None:
            return FakeResponse(self.force_status, self.force_payload or {"error": True, "message": "forced"}, self.force_headers)
        direction = "OUTPUT" if url.endswith("/output") else json.get("direction", "INPUT")
        text = json.get("message") or json.get("aiResponse") or json.get("text") or ""
        return FakeResponse(200, verdict_for(text, direction))


# ---------------------------------------------------------------------------
# Async mock: a fake httpx.AsyncClient
# ---------------------------------------------------------------------------
class FakeAsyncResponse:
    def __init__(self, status_code: int, payload: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> None:
        self.status_code = status_code
        self._payload = payload
        self.headers = headers or {}

    @property
    def text(self) -> str:
        return json.dumps(self._payload)


class FakeAsyncClient:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.requests: List[RecordedRequest] = []

    async def post(self, url: str, json: Dict[str, Any], headers: Dict[str, str], timeout: Any = None) -> FakeAsyncResponse:  # noqa: A002
        self.requests.append(RecordedRequest(url, dict(headers), dict(json)))
        text = json.get("message") or json.get("aiResponse") or json.get("text") or ""
        return FakeAsyncResponse(200, verdict_for(text, "INPUT"))

    async def aclose(self) -> None:
        return None


@pytest.fixture
def fake_session() -> FakeSession:
    return FakeSession()


@pytest.fixture
def guard(fake_session: FakeSession):
    from cyberrakshak_guard import CyberRakshakGuard

    return CyberRakshakGuard(api_key="ck_test_key_123456", base_url="http://localhost:3000", session=fake_session)
