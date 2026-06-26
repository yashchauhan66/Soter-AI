"""
Soter Guard Component for Langflow

Provides Input Guard, Output Guard, PII Redactor, and RAG Scanner
as Langflow custom components that call the Soter REST API.

Installation:
1. Copy this file to your Langflow custom components directory
2. Restart Langflow
3. The Soter Guard components will appear in the sidebar
"""

import json
import urllib.request
import urllib.error
from typing import Optional


class SoterGuardComponent:
    """Base Langflow component for Soter Guard API calls."""

    display_name = "Soter Guard"
    description = "AI security guard — checks text for prompt injection, jailbreaks, PII, and unsafe content"
    icon = "shield"

    def build_config(self):
        return {
            "api_key": {
                "display_name": "Soter API Key",
                "type": "password",
                "required": True,
                "info": "Your Soter Guard API key (sk_...)",
            },
            "base_url": {
                "display_name": "Base URL",
                "type": "str",
                "value": "https://api.cybersecurityguard.com",
                "info": "Soter Guard API base URL",
            },
            "project_id": {
                "display_name": "Project ID",
                "type": "str",
                "required": False,
                "info": "Soter project ID (optional)",
            },
            "policy_mode": {
                "display_name": "Policy Mode",
                "type": "str",
                "options": ["MONITOR", "BALANCED", "STRICT"],
                "value": "BALANCED",
                "info": "Server-side policy strictness",
            },
            "on_threat": {
                "display_name": "On Threat",
                "type": "str",
                "options": ["BLOCK", "REDACT", "WARN", "CONTINUE"],
                "value": "BLOCK",
                "info": "What to do when a threat is detected",
            },
        }

    def _call_soter_api(
        self,
        api_key: str,
        base_url: str,
        path: str,
        body: dict,
        project_id: Optional[str] = None,
        policy_mode: Optional[str] = None,
    ) -> dict:
        """Make an authenticated POST request to the Soter API."""
        url = f"{base_url.rstrip('/')}{path}"
        metadata = {}
        if project_id:
            metadata["projectId"] = project_id
        if policy_mode:
            metadata["policyMode"] = policy_mode
        body["metadata"] = {**body.get("metadata", {}), **metadata}

        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "User-Agent": "soter-langflow-component/1.0",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8") if e.fp else "{}"
            try:
                error_data = json.loads(error_body)
                msg = error_data.get("message", f"Soter API error {e.code}")
            except json.JSONDecodeError:
                msg = f"Soter API error {e.code}"
            raise RuntimeError(msg) from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"Cannot reach Soter API: {e.reason}") from e


class SoterInputGuard(SoterGuardComponent):
    """Check user input for prompt injection, jailbreaks, and threats."""

    display_name = "Soter Input Guard"
    description = "Check user messages for prompt injection, jailbreaks, PII, and other threats before LLM processing"

    def build(
        self,
        input_text: str,
        api_key: str,
        base_url: str = "https://api.cybersecurityguard.com",
        project_id: str = "",
        policy_mode: str = "BALANCED",
        on_threat: str = "BLOCK",
    ) -> dict:
        result = self._call_soter_api(
            api_key=api_key,
            base_url=base_url,
            path="/api/guard/input",
            body={"message": input_text},
            project_id=project_id or None,
            policy_mode=policy_mode,
        )

        allowed = result.get("allowed", True)
        safe_text = result.get("safeText") or result.get("redactedText") or input_text
        reason = result.get("reason", "")
        risk_score = result.get("riskScore", 0)
        categories = result.get("riskTypes", [])

        if allowed:
            return {
                "allowed": True,
                "blocked": False,
                "safe_text": safe_text,
                "risk_score": risk_score,
                "categories": categories,
                "reason": reason,
            }

        if on_threat == "BLOCK":
            return {"allowed": False, "blocked": True, "safe_text": "", "risk_score": risk_score, "categories": categories, "reason": reason}
        elif on_threat == "REDACT":
            return {"allowed": False, "blocked": False, "safe_text": safe_text, "risk_score": risk_score, "categories": categories, "reason": reason}
        elif on_threat == "WARN":
            return {"allowed": False, "blocked": False, "safe_text": input_text, "risk_score": risk_score, "categories": categories, "reason": reason, "warning": reason}
        else:  # CONTINUE
            return {"allowed": True, "blocked": False, "safe_text": input_text, "risk_score": risk_score, "categories": categories, "reason": reason}


class SoterOutputGuard(SoterGuardComponent):
    """Check AI output for unsafe content before sending to the user."""

    display_name = "Soter Output Guard"
    description = "Check AI responses for unsafe content, system prompt leakage, and PII before sending to users"

    def build(
        self,
        output_text: str,
        api_key: str,
        base_url: str = "https://api.cybersecurityguard.com",
        project_id: str = "",
        policy_mode: str = "BALANCED",
        on_threat: str = "BLOCK",
    ) -> dict:
        result = self._call_soter_api(
            api_key=api_key,
            base_url=base_url,
            path="/api/guard/output",
            body={"aiResponse": output_text},
            project_id=project_id or None,
            policy_mode=policy_mode,
        )

        allowed = result.get("allowed", True)
        safe_text = result.get("safeText") or result.get("redactedText") or output_text
        reason = result.get("reason", "")
        risk_score = result.get("riskScore", 0)
        categories = result.get("riskTypes", [])

        if allowed:
            return {"allowed": True, "blocked": False, "safe_text": safe_text, "risk_score": risk_score, "categories": categories, "reason": reason}

        if on_threat == "BLOCK":
            return {"allowed": False, "blocked": True, "safe_text": "The AI response was blocked for security reasons.", "risk_score": risk_score, "categories": categories, "reason": reason}
        elif on_threat == "REDACT":
            return {"allowed": False, "blocked": False, "safe_text": safe_text, "risk_score": risk_score, "categories": categories, "reason": reason}
        elif on_threat == "WARN":
            return {"allowed": False, "blocked": False, "safe_text": output_text, "risk_score": risk_score, "categories": categories, "reason": reason, "warning": reason}
        else:
            return {"allowed": True, "blocked": False, "safe_text": output_text, "risk_score": risk_score, "categories": categories, "reason": reason}


class SoterPiiRedactor(SoterGuardComponent):
    """Redact PII and secrets from any text."""

    display_name = "Soter PII Redactor"
    description = "Redact PII, secrets, and sensitive data from text using Soter Guard"

    def build_config(self):
        config = super().build_config()
        config["redaction_mode"] = {
            "display_name": "Redaction Mode",
            "type": "str",
            "options": ["PARTIAL", "FULL", "HASH"],
            "value": "PARTIAL",
        }
        del config["policy_mode"]
        del config["on_threat"]
        return config

    def build(
        self,
        text: str,
        api_key: str,
        base_url: str = "https://api.cybersecurityguard.com",
        project_id: str = "",
        redaction_mode: str = "PARTIAL",
    ) -> dict:
        metadata = {"_redactionMode": redaction_mode}
        if project_id:
            metadata["projectId"] = project_id

        result = self._call_soter_api(
            api_key=api_key,
            base_url=base_url,
            path="/api/guard/input",
            body={"message": text, "metadata": metadata},
        )

        safe_text = result.get("safeText") or result.get("redactedText") or text
        findings = result.get("findings", [])
        entities = [
            {"type": f.get("type"), "label": f.get("label"), "severity": f.get("severity")}
            for f in findings
            if f.get("type") in ("PII_DETECTED", "INDIA_PII_DETECTED", "SECRET_DETECTED")
        ]

        return {
            "safe_text": safe_text,
            "detected_entities": entities,
            "risk_score": result.get("riskScore", 0),
        }


class SoterRagScanner(SoterGuardComponent):
    """Scan documents/chunks before adding to a RAG vector database."""

    display_name = "Soter RAG Scanner"
    description = "Scan documents and chunks for threats before adding to RAG/vector DB"

    def build_config(self):
        config = super().build_config()
        config["source_name"] = {
            "display_name": "Source Name",
            "type": "str",
            "required": False,
            "info": "Optional label for the document source",
        }
        del config["on_threat"]
        return config

    def build(
        self,
        document_text: str,
        api_key: str,
        base_url: str = "https://api.cybersecurityguard.com",
        project_id: str = "",
        policy_mode: str = "BALANCED",
        source_name: str = "",
    ) -> dict:
        metadata = {"_ragScan": True}
        if project_id:
            metadata["projectId"] = project_id
        if source_name:
            metadata["_sourceName"] = source_name

        result = self._call_soter_api(
            api_key=api_key,
            base_url=base_url,
            path="/api/guard/input",
            body={"message": document_text, "metadata": metadata},
            policy_mode=policy_mode,
        )

        findings = result.get("findings", [])
        issues = [
            {"type": f.get("type"), "severity": f.get("severity"), "message": f.get("message", f.get("label", ""))}
            for f in findings
        ]

        return {
            "allowed": result.get("allowed", True),
            "risk_score": result.get("riskScore", 0),
            "issues": issues,
            "safe_text": result.get("safeText") or result.get("redactedText") or document_text,
            "incident_id": result.get("incidentId"),
        }
