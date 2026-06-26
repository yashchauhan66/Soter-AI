"""SoterAI provider — validates API credentials on plugin install."""

import json
import urllib.request
import urllib.error
from typing import Any


class SoterAIProvider:
    """Dify provider that validates the SoterAI API key at setup time."""

    def validate_credentials(self, credentials: dict) -> None:
        """Hit the SoterAI health endpoint to confirm the API key is valid.

        Raises
        ------
        Exception
            If the key is missing, the server is unreachable, or authentication
            fails.
        """
        api_key = credentials.get("soter_api_key", "")
        if not api_key:
            raise Exception("SoterAI API Key is required")

        base_url = (
            credentials
            .get("soter_base_url", "https://api.soterai.dev")
            .rstrip("/")
        )

        req = urllib.request.Request(
            f"{base_url}/api/health",
            headers={
                "x-api-key": api_key,
                "User-Agent": "soterai-dify-plugin/0.1.0",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status != 200:
                    raise Exception("Invalid API key or unreachable server")
        except urllib.error.HTTPError as exc:
            raise Exception(f"Authentication failed: {exc.code}")
        except urllib.error.URLError as exc:
            raise Exception(f"Cannot reach SoterAI API: {exc.reason}")
