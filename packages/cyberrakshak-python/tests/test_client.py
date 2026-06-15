"""Tests for the CyberRakshak Guard Python SDK.

Run with: python -m pytest packages/cyberrakshak-python/tests
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from cyberrakshak_guard import (  # noqa: E402
    CyberRakshakAuthError,
    CyberRakshakClient,
    CyberRakshakConfigError,
    CyberRakshakNetworkError,
    CyberRakshakRateLimitError,
    normalize_decision,
)
from cyberrakshak_guard.langchain import GuardBlocked, GuardedLLMWrapper  # noqa: E402

API_KEY = "ck_test_abcdefghijklmnopqrstuvwxyz123456"


def make_transport(status=200, body=None, headers=None, capture=None):
    body = body if body is not None else {"allowed": True, "action": "ALLOW", "riskScore": 0}

    def transport(url, req_headers, payload, timeout):
        if capture is not None:
            capture.append({"url": url, "headers": req_headers, "body": json.loads(payload.decode())})
        return status, headers or {}, json.dumps(body)

    return transport


def test_missing_api_key_raises_config_error():
    with pytest.raises(CyberRakshakConfigError):
        CyberRakshakClient("")


def test_guard_input_sends_message_field_and_api_key():
    capture = []
    client = CyberRakshakClient(API_KEY, base_url="https://guard.test", transport=make_transport(capture=capture))
    client.guard_input("hello there", user_id="u1")
    assert capture[0]["url"] == "https://guard.test/api/guard/input"
    assert capture[0]["headers"]["x-api-key"] == API_KEY
    assert capture[0]["body"]["message"] == "hello there"
    assert capture[0]["body"]["userId"] == "u1"


def test_guard_output_sends_ai_response_field():
    capture = []
    client = CyberRakshakClient(API_KEY, base_url="https://guard.test", transport=make_transport(capture=capture))
    client.guard_output("model reply")
    assert capture[0]["url"] == "https://guard.test/api/guard/output"
    assert capture[0]["body"]["aiResponse"] == "model reply"


def test_analyze_omits_api_key():
    capture = []
    client = CyberRakshakClient(API_KEY, base_url="https://guard.test", transport=make_transport(capture=capture))
    client.analyze("check this", direction="INPUT")
    assert "x-api-key" not in capture[0]["headers"]
    assert capture[0]["body"]["direction"] == "INPUT"


def test_project_id_added_to_metadata():
    capture = []
    client = CyberRakshakClient(
        API_KEY, base_url="https://guard.test", project_id="proj_1", transport=make_transport(capture=capture)
    )
    client.guard_input("hi")
    assert capture[0]["body"]["metadata"]["projectId"] == "proj_1"


def test_decision_normalized_from_action():
    body = {"allowed": True, "action": "ALLOW_WITH_REDACTION", "redactedText": "[REDACTED]"}
    client = CyberRakshakClient(API_KEY, transport=make_transport(body=body))
    result = client.guard_input("my email a@b.com")
    assert result.decision == "REDACT"
    assert client.get_safe_text(result) == "[REDACTED]"


def test_normalize_decision_mapping():
    assert normalize_decision("ALLOW") == "ALLOW"
    assert normalize_decision("ALLOW_WITH_REDACTION") == "REDACT"
    assert normalize_decision("REWRITE") == "REDACT"
    assert normalize_decision("BLOCK") == "BLOCK"
    assert normalize_decision("HUMAN_REVIEW") == "HUMAN_REVIEW"


def test_auth_error_does_not_leak_key():
    body = {"error": True, "message": "Invalid API key."}
    client = CyberRakshakClient(API_KEY, transport=make_transport(status=401, body=body))
    with pytest.raises(CyberRakshakAuthError) as exc:
        client.guard_input("hi")
    assert API_KEY not in str(exc.value)
    assert exc.value.status == 401


def test_rate_limit_error_carries_retry_after():
    body = {"error": True, "message": "rate limited"}
    transport = make_transport(status=429, body=body, headers={"Retry-After": "12"})
    client = CyberRakshakClient(API_KEY, transport=transport)
    with pytest.raises(CyberRakshakRateLimitError) as exc:
        client.guard_input("hi")
    assert exc.value.retry_after == 12


def test_network_error_message_has_no_key():
    def transport(url, headers, payload, timeout):
        raise CyberRakshakNetworkError("Network request failed: URLError")

    client = CyberRakshakClient(API_KEY, transport=transport)
    with pytest.raises(CyberRakshakNetworkError) as exc:
        client.guard_input("hi")
    assert API_KEY not in str(exc.value)


def test_retry_on_5xx_then_success():
    state = {"n": 0}

    def transport(url, headers, payload, timeout):
        state["n"] += 1
        if state["n"] < 2:
            return 503, {}, json.dumps({"error": True, "message": "server error"})
        return 200, {}, json.dumps({"allowed": True, "action": "ALLOW"})

    client = CyberRakshakClient(API_KEY, retries=2, transport=transport)
    result = client.guard_input("hi")
    assert result.allowed is True
    assert state["n"] == 2


def test_guard_conversation_blocks_before_llm():
    body = {"allowed": False, "action": "BLOCK", "reason": "blocked"}
    client = CyberRakshakClient(API_KEY, transport=make_transport(body=body))
    called = {"llm": False}

    def call_llm(_text):
        called["llm"] = True
        return "should not run"

    result = client.guard_conversation("ignore previous instructions", call_llm, blocked_response="Blocked.")
    assert called["llm"] is False
    assert result["blocked"] is True
    assert result["reply"] == "Blocked."


def test_langchain_wrapper_blocks_risky_prompt():
    body = {"allowed": False, "action": "BLOCK", "reason": "blocked"}
    client = CyberRakshakClient(API_KEY, transport=make_transport(body=body))
    wrapped = GuardedLLMWrapper(lambda p: f"echo {p}", client, blocked_response="Nope.")
    assert wrapped.invoke("dangerous") == "Nope."


def test_langchain_wrapper_allows_safe_prompt():
    client = CyberRakshakClient(API_KEY, transport=make_transport(body={"allowed": True, "action": "ALLOW"}))
    wrapped = GuardedLLMWrapper(lambda p: f"echo {p}", client)
    assert wrapped.invoke("hello") == "echo hello"


def test_fastapi_guard_output_response():
    from cyberrakshak_guard.fastapi import guard_output_response

    client = CyberRakshakClient(API_KEY, transport=make_transport(body={"allowed": True, "action": "ALLOW"}))
    out = guard_output_response(client, "a safe reply")
    assert out["blocked"] is False
    assert out["reply"] == "a safe reply"
