"""Typed result objects and request types for the CyberRakshak Guard SDK.

The REST API returns camelCase JSON (``riskScore``, ``safeText`` ...). The SDK
wraps those payloads in dataclass-like objects that expose Pythonic snake_case
attributes (``result.risk_score``) while still supporting dict-style access for
both naming styles (``result["riskScore"]`` and ``result["risk_score"]``).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

GuardAction = str  # ALLOW | ALLOW_WITH_REDACTION | REWRITE | BLOCK | HUMAN_REVIEW
GuardDirection = str  # INPUT | OUTPUT | ANALYZE

# Actions that mean "it is safe to call the LLM".
LLM_SAFE_ACTIONS = frozenset({"ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"})


@dataclass
class GuardFinding:
    """A single detector finding inside a :class:`GuardResult`."""

    type: str
    label: str = ""
    severity: str = "LOW"
    score: float = 0.0
    message: str = ""
    matched: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict, repr=False)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GuardFinding":
        return cls(
            type=str(data.get("type", "")),
            label=str(data.get("label", "")),
            severity=str(data.get("severity", "LOW")),
            score=float(data.get("score", 0) or 0),
            message=str(data.get("message", "")),
            matched=data.get("matched"),
            raw=dict(data),
        )


@dataclass
class GuardResult:
    """Normalized result of an input/output/analyze guard call.

    Mirrors the API ``GuardResult`` contract. Attributes use snake_case; the
    untouched server payload is kept in :attr:`raw`.
    """

    allowed: bool
    action: GuardAction
    risk_score: float = 0.0
    risk_types: List[str] = field(default_factory=list)
    reason: str = ""
    redacted_text: Optional[str] = None
    safe_text: Optional[str] = None
    findings: List[GuardFinding] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    raw: Dict[str, Any] = field(default_factory=dict, repr=False)

    # --- construction ---------------------------------------------------
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GuardResult":
        findings = [GuardFinding.from_dict(f) for f in (data.get("findings") or []) if isinstance(f, dict)]
        return cls(
            allowed=bool(data.get("allowed", False)),
            action=str(data.get("action", "BLOCK")),
            risk_score=float(data.get("riskScore", data.get("risk_score", 0)) or 0),
            risk_types=list(data.get("riskTypes", data.get("risk_types", [])) or []),
            reason=str(data.get("reason", "")),
            redacted_text=data.get("redactedText", data.get("redacted_text")),
            safe_text=data.get("safeText", data.get("safe_text")),
            findings=findings,
            metadata=dict(data.get("metadata") or {}),
            raw=dict(data),
        )

    # --- convenience ----------------------------------------------------
    @property
    def blocked(self) -> bool:
        return not self.allowed or self.action in {"BLOCK", "HUMAN_REVIEW"}

    def to_dict(self) -> Dict[str, Any]:
        """Return the original camelCase server payload (safe to serialize)."""
        return dict(self.raw)

    # Allow ``result["riskScore"]`` and ``result["risk_score"]``.
    def __getitem__(self, key: str) -> Any:
        if key in self.raw:
            return self.raw[key]
        return getattr(self, key)

    def get(self, key: str, default: Any = None) -> Any:
        try:
            return self[key]
        except (KeyError, AttributeError):
            return default


@dataclass
class RagSource:
    """A retrieved document/chunk passed into :meth:`protect_rag`."""

    text: str
    id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    citation: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {"id": self.id, "text": self.text, "metadata": self.metadata, "citation": self.citation}


@dataclass
class SafeRagSource:
    """A retrieved source that passed the guard, with its safe text + verdict."""

    text: str
    safe_text: str
    guard: GuardResult
    id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    citation: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "text": self.text,
            "safeText": self.safe_text,
            "metadata": self.metadata,
            "citation": self.citation,
            "guard": self.guard.to_dict(),
        }


@dataclass
class ExcludedRagSource:
    """A retrieved source that was dropped because the guard flagged it."""

    source: RagSource
    guard: GuardResult

    def to_dict(self) -> Dict[str, Any]:
        return {"source": self.source.to_dict(), "guard": self.guard.to_dict()}


class _DictAccessResult:
    """Mixin giving result dataclasses dict-style access for both snake_case
    attributes and the camelCase keys developers may already expect."""

    _CAMEL: Dict[str, str] = {}

    def __getitem__(self, key: str) -> Any:
        attr = self._CAMEL.get(key, key)
        return getattr(self, attr)

    def get(self, key: str, default: Any = None) -> Any:
        try:
            return self[key]
        except AttributeError:
            return default


@dataclass
class ProtectChatResult(_DictAccessResult):
    """Result of :meth:`protect_chat`."""

    allowed: bool
    blocked: bool
    input_action: GuardAction
    llm_called: bool
    safe_response: str
    input_guard: GuardResult
    latency_ms: int
    output_action: Optional[GuardAction] = None
    output_guard: Optional[GuardResult] = None

    _CAMEL = {
        "inputAction": "input_action",
        "outputAction": "output_action",
        "llmCalled": "llm_called",
        "safeResponse": "safe_response",
        "inputGuard": "input_guard",
        "outputGuard": "output_guard",
        "latencyMs": "latency_ms",
    }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "allowed": self.allowed,
            "blocked": self.blocked,
            "inputAction": self.input_action,
            "outputAction": self.output_action,
            "llmCalled": self.llm_called,
            "safeResponse": self.safe_response,
            "inputGuard": self.input_guard.to_dict(),
            "outputGuard": self.output_guard.to_dict() if self.output_guard else None,
            "latencyMs": self.latency_ms,
        }


@dataclass
class ProtectRagResult(_DictAccessResult):
    """Result of :meth:`protect_rag`."""

    allowed: bool
    blocked: bool
    input_action: GuardAction
    llm_called: bool
    retrieved: int
    used_sources: List[SafeRagSource]
    excluded_sources: List[ExcludedRagSource]
    safe_response: str
    input_guard: GuardResult
    latency_ms: int
    output_action: Optional[GuardAction] = None
    output_guard: Optional[GuardResult] = None

    _CAMEL = {
        "inputAction": "input_action",
        "outputAction": "output_action",
        "llmCalled": "llm_called",
        "usedSources": "used_sources",
        "excludedSources": "excluded_sources",
        "safeResponse": "safe_response",
        "inputGuard": "input_guard",
        "outputGuard": "output_guard",
        "latencyMs": "latency_ms",
    }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "allowed": self.allowed,
            "blocked": self.blocked,
            "inputAction": self.input_action,
            "outputAction": self.output_action,
            "llmCalled": self.llm_called,
            "retrieved": self.retrieved,
            "usedSources": [s.to_dict() for s in self.used_sources],
            "excludedSources": [s.to_dict() for s in self.excluded_sources],
            "safeResponse": self.safe_response,
            "inputGuard": self.input_guard.to_dict(),
            "outputGuard": self.output_guard.to_dict() if self.output_guard else None,
            "latencyMs": self.latency_ms,
        }


__all__ = [
    "GuardAction",
    "GuardDirection",
    "GuardFinding",
    "GuardResult",
    "RagSource",
    "SafeRagSource",
    "ExcludedRagSource",
    "ProtectChatResult",
    "ProtectRagResult",
    "LLM_SAFE_ACTIONS",
]
