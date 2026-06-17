"""Security-focused tests: API key never leaks into bodies, logs, or reprs."""

from __future__ import annotations

import logging

from cyberrakshak_guard import CyberRakshakGuard
from cyberrakshak_guard.utils import redact_key
from conftest import FakeSession

API_KEY = "ck_test_key_supersecret_value_123456"


def _make_guard():
    session = FakeSession()
    return CyberRakshakGuard(api_key=API_KEY, base_url="http://localhost:3000", session=session), session


def test_api_key_only_in_header_never_in_body():
    guard, session = _make_guard()
    guard.protect_chat(message="hello", call_llm=lambda s: "hi")
    for req in session.requests:
        assert API_KEY not in str(req.body)
        if req.url.endswith(("/input", "/output")):
            assert req.headers.get("x-api-key") == API_KEY


def test_redact_key_never_exposes_full_value():
    fingerprint = redact_key(API_KEY)
    assert API_KEY not in fingerprint
    assert fingerprint.startswith("ck_t")
    assert len(fingerprint) < len(API_KEY)


def test_repr_does_not_leak_key():
    guard, _ = _make_guard()
    # The client itself should not dump the key in its default repr.
    assert API_KEY not in repr(guard)


def test_no_logging_of_full_key(caplog):
    caplog.set_level(logging.DEBUG)
    guard, _ = _make_guard()
    guard.protect_chat(message="my password is hunter2", call_llm=lambda s: "noted")
    for record in caplog.records:
        assert API_KEY not in record.getMessage()
