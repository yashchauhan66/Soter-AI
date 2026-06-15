"""Type definitions and constants for the CyberRakshak Guard Python SDK."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional

GuardAction = Literal["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE", "BLOCK", "HUMAN_REVIEW"]
# Normalized, integration-friendly decision derived from the server ``action``.
GuardDecision = Literal["ALLOW", "REDACT", "BLOCK", "HUMAN_REVIEW"]
GuardDirection = Literal["INPUT", "OUTPUT", "ANALYZE"]
Severity = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]

RISK_TYPES = (
    "PROMPT_INJECTION",
    "JAILBREAK",
    "SYSTEM_PROMPT_LEAK_ATTEMPT",
    "SYSTEM_PROMPT_LEAKAGE",
    "PII_DETECTED",
    "INDIA_PII_DETECTED",
    "SECRET_DETECTED",
    "UNSAFE_OUTPUT",
    "RATE_LIMIT",
    "TOKEN_ABUSE",
    "LOW_RISK",
)


def normalize_decision(action: str) -> str:
    """Map the server ``action`` onto a normalized :data:`GuardDecision`."""
    if action == "ALLOW":
        return "ALLOW"
    if action in ("ALLOW_WITH_REDACTION", "REWRITE"):
        return "REDACT"
    if action == "HUMAN_REVIEW":
        return "HUMAN_REVIEW"
    return "BLOCK"


@dataclass
class GuardFinding:
    type: str
    label: str
    severity: str
    score: float
    message: str
    matched: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GuardFinding":
        return cls(
            type=data.get("type", "LOW_RISK"),
            label=data.get("label", ""),
            severity=data.get("severity", "LOW"),
            score=float(data.get("score", 0) or 0),
            message=data.get("message", ""),
            matched=data.get("matched"),
        )


@dataclass
class GuardResult:
    """Typed view of a Guard API response.

    The server never returns the original text. ``decision`` is computed by the
    SDK from ``action`` for convenience.
    """

    allowed: bool
    action: str
    risk_score: float
    risk_types: List[str] = field(default_factory=list)
    reason: str = ""
    redacted_text: Optional[str] = None
    safe_text: Optional[str] = None
    findings: List[GuardFinding] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    decision: str = "ALLOW"
    raw: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GuardResult":
        action = data.get("action", "ALLOW")
        return cls(
            allowed=bool(data.get("allowed", action == "ALLOW")),
            action=action,
            risk_score=float(data.get("riskScore", 0) or 0),
            risk_types=list(data.get("riskTypes", []) or []),
            reason=data.get("reason", ""),
            redacted_text=data.get("redactedText"),
            safe_text=data.get("safeText"),
            findings=[GuardFinding.from_dict(f) for f in data.get("findings", []) or []],
            metadata=data.get("metadata", {}) or {},
            decision=data.get("decision") or normalize_decision(action),
            raw=data,
        )
