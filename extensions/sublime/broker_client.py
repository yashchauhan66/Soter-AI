"""Thin stdlib HTTP client for the SoterAI Local AI Broker.

This module intentionally has no Sublime Text dependency so it can be
syntax-checked and unit-reasoned about outside the editor. All detector,
redaction and policy logic lives in the broker; this client only speaks the
documented loopback HTTP contract.

Security notes:
- The broker listens on loopback only and requires a bearer token on every
  endpoint except GET /health.
- The token is a credential. It is never written to logs, status messages or
  error strings by this module.
"""

import json
import os
import urllib.error
import urllib.request

DEFAULT_BROKER_URL = "http://127.0.0.1:47321"
DEFAULT_TOKEN_PATH = os.path.join("~", ".soterai", "broker", "auth-token")


class BrokerError(Exception):
    """Raised for any failure talking to the Local AI Broker."""


def resolve_token(token="", token_path=""):
    """Return the broker token.

    Preference order:
    1. An explicit token value (from settings).
    2. The contents of the token file at token_path (default
       ~/.soterai/broker/auth-token).

    Returns an empty string when no token can be found. The token value is
    never logged by this function.
    """
    if token:
        return token.strip()
    path = os.path.expanduser(token_path or DEFAULT_TOKEN_PATH)
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read().strip()
    except OSError:
        return ""


def _summarize_http_error(error):
    """Extract a short, non-sensitive detail from an HTTPError body.

    The broker returns its own (already redacted) error messages. We still cap
    the length so a large body cannot flood the output panel.
    """
    try:
        raw = error.read().decode("utf-8", "replace")
    except Exception:
        return ""
    if not raw:
        return ""
    try:
        parsed = json.loads(raw)
        message = parsed.get("error", {})
        if isinstance(message, dict):
            message = message.get("message", "")
        if message:
            return ": " + str(message)[:200]
    except ValueError:
        pass
    return ": " + raw[:200]


class BrokerClient(object):
    def __init__(self, base_url=DEFAULT_BROKER_URL, token="", timeout=10):
        self.base_url = (base_url or DEFAULT_BROKER_URL).rstrip("/")
        self._token = token or ""
        try:
            self.timeout = float(timeout)
        except (TypeError, ValueError):
            self.timeout = 10.0

    # --- endpoints -----------------------------------------------------

    def health(self):
        return self._request("GET", "/health", authenticated=False)

    def version(self):
        return self._request("GET", "/version")

    def scan(self, content=None, messages=None):
        if messages is not None:
            body = {"messages": messages}
        else:
            body = {"content": content or ""}
        return self._request("POST", "/v1/scan", body=body)

    def redact(self, content):
        result = self._request("POST", "/v1/redact", body={"content": content or ""})
        return result.get("redacted", "")

    def safe_mode_status(self):
        return self._request("GET", "/v1/safe-mode/status")

    def safe_mode_enable(self, level="developer"):
        return self._request("POST", "/v1/safe-mode/enable", body={"level": level})

    def safe_mode_disable(self):
        return self._request("POST", "/v1/safe-mode/disable", body={})

    def recent_events(self):
        return self._request("GET", "/v1/events/recent")

    # --- transport -----------------------------------------------------

    def _request(self, method, path, body=None, authenticated=True):
        url = self.base_url + path
        data = None
        headers = {"Accept": "application/json"}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if authenticated:
            if not self._token:
                raise BrokerError(
                    "Local AI Broker token is not configured. Set 'token' or "
                    "'token_path' in the SoterAI Guard settings."
                )
            headers["Authorization"] = "Bearer " + self._token

        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as error:
            detail = _summarize_http_error(error)
            raise BrokerError(
                "Local broker returned HTTP {} for {}{}".format(error.code, path, detail)
            )
        except urllib.error.URLError as error:
            reason = getattr(error, "reason", error)
            raise BrokerError(
                "Could not reach the Local AI Broker at {} ({}). Is the broker "
                "running?".format(self.base_url, reason)
            )
        except OSError as error:
            raise BrokerError(
                "Could not reach the Local AI Broker at {} ({}).".format(self.base_url, error)
            )

        if not raw:
            return {}
        try:
            return json.loads(raw)
        except ValueError:
            raise BrokerError("Local broker returned a response that was not valid JSON.")
