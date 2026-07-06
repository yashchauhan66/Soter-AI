# Local AI Broker Security Model

## Security invariants

- The listener address is the constant `127.0.0.1`; user configuration changes only the port.
- Only `/health` is public. `/version` and all `/v1/*` endpoints require a timing-safe bearer-token comparison.
- CORS is disabled by default. Requests carrying an unapproved `Origin` are rejected before their body is processed.
- Request bodies default to 1 MiB maximum, requests time out, and each local address has a per-minute limit.
- Provider targets come from trusted local configuration, not from a client-supplied request URL. This prevents the proxy route from becoming an arbitrary SSRF relay.
- Broker and provider keys never enter event, memory, report, webview, or structured-log payloads.
- Canary content blocks before provider forwarding. A canary in a provider response blocks that response from returning to the client.
- If scanning throws, the request scan fails closed. Safe Mode can only make a decision stricter.
- Approval grants bind to `sessionId + contentHash`, expire, and `once` grants are consumed after one use.

## Trust boundaries

The local user account and extension SecretStorage are trusted. Other local processes, browser pages, model providers, model output, tool messages, and workspace content are untrusted. Loopback reduces exposure but is not treated as authentication; the bearer token remains mandatory.

## Privacy

Scanning and redaction are local. The configured provider receives only requests that pass policy, with secret-bearing messages redacted. SoterAI Cloud is not contacted by the broker. Provider traffic still leaves the machine for the user-selected provider; use a local model endpoint when no external egress is desired.

Memory/event exports are sanitized again on export. They may contain file paths and operational metadata, so users should still review them before external sharing.

## Failure behavior

| Failure | Result |
| --- | --- |
| Missing/invalid broker token | `401`, no scan or forwarding |
| Browser origin | `403`, no CORS response |
| Oversized/invalid JSON | `413`/`400` structured error |
| Provider missing/unreachable | `503`/`502`; no alternate provider |
| Request blocked | `422`; provider not called |
| Approval missing | `403`; exact content hash is reported only in authenticated audit data |
| Unsafe provider output | `422`; raw unsafe output is withheld |
| Broker restart | Process-local memory/events/approvals are cleared |

This design materially reduces routed AI egress risk. It is not a claim of complete security; bypassing traffic is outside broker enforcement.
