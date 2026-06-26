"""SoterAI PII Redactor tool — redacts PII, secrets, and sensitive data."""

import json
import urllib.request
import urllib.error
from typing import Any


class PIIRedactorTool:
    """Calls POST /api/guard/input with _redactionMode metadata to redact
    personally identifiable information from arbitrary text."""

    def _invoke(
        self,
        tool_parameters: dict[str, Any],
        credentials: dict[str, Any],
    ) -> str:
        text = tool_parameters.get("text", "")
        if not text:
            return json.dumps({"error": "text parameter is required"})

        api_key = credentials.get("soter_api_key", "")
        base_url = (
            credentials
            .get("soter_base_url", "https://api.soterai.dev")
            .rstrip("/")
        )
        project_id = (
            tool_parameters.get("project_id")
            or credentials.get("soter_project_id", "")
        )
        redaction_mode = tool_parameters.get("redaction_mode", "PARTIAL")

        payload: dict[str, Any] = {
            "message": text,
            "metadata": {
                "source": "dify-plugin",
                "_redactionMode": redaction_mode,
            },
        }
        if project_id:
            payload["metadata"]["projectId"] = project_id

        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{base_url}/api/guard/input",
            data=body,
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "User-Agent": "soterai-dify-plugin/0.1.0",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            return json.dumps({
                "error": f"SoterAI API error: {exc.code}",
                "detail": exc.read().decode("utf-8", errors="replace"),
            })
        except urllib.error.URLError as exc:
            return json.dumps({
                "error": f"Cannot reach SoterAI API: {exc.reason}",
            })

        return json.dumps({
            "redactedText": data.get("safeText", text),
            "entitiesFound": data.get("categories", []),
            "riskScore": data.get("riskScore", 0),
        })
