"""SoterAI Output Guard tool — scans AI responses before delivery."""

import json
import urllib.request
import urllib.error
from typing import Any


class OutputGuardTool:
    """Calls POST /api/guard/output to detect unsafe content, system prompt
    leakage, and PII in AI-generated responses."""

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
        policy_mode = tool_parameters.get("policy_mode", "BALANCED")

        payload: dict[str, Any] = {
            "aiResponse": text,
            "metadata": {
                "source": "dify-plugin",
                "policyMode": policy_mode,
            },
        }
        if project_id:
            payload["metadata"]["projectId"] = project_id

        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{base_url}/api/guard/output",
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
            "allowed": data.get("allowed", True),
            "riskScore": data.get("riskScore", 0),
            "categories": data.get("categories", []),
            "safeText": data.get("safeText", text),
            "reason": data.get("reason", ""),
        })
